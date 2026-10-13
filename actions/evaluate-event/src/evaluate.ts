export interface EventContext {
	eventName: string;
	ref: string;
	sha: string;
	actor: string;
	repository: string;
	payload: {
		pull_request?: { head?: { sha?: string; repo?: { full_name?: string } } };
		merge_group?: { head_sha?: string };
	};
}

export interface Evaluation {
	commitSha: string;
	mode: "pr" | "main" | "none";
	trusted: boolean;
}

/**
 * Resolves the commit, mode and trust of the triggering event.
 */
export function evaluate(ctx: EventContext, defaultBranch: string): Evaluation {
	if (ctx.eventName === "pull_request_target") {
		throw new Error(
			"'pull_request_target' is not supported. Switch the caller to 'pull_request'.",
		);
	}

	const pullRequest = ctx.payload.pull_request;
	// Empty strings fall through, matching shell `||` semantics.
	/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
	const commitSha =
		pullRequest?.head?.sha || ctx.payload.merge_group?.head_sha || ctx.sha;
	/* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

	let mode: Evaluation["mode"] = "none";
	if (ctx.eventName === "pull_request") {
		mode = "pr";
	} else if (
		ctx.eventName === "push" &&
		ctx.ref === `refs/heads/${defaultBranch}`
	) {
		mode = "main";
	}

	// Pull requests from forks and Dependabot cannot use credentials.
	const trusted = !(
		ctx.eventName === "pull_request" &&
		(pullRequest?.head?.repo?.full_name !== ctx.repository ||
			ctx.actor === "dependabot[bot]")
	);

	return { commitSha, mode, trusted };
}
