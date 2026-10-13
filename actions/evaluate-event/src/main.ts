import * as core from "@actions/core";
import { context } from "@actions/github";

import { evaluate } from "./evaluate.js";

import type { EventContext } from "./evaluate.js";

try {
	const defaultBranch = core.getInput("default-branch", { required: true });

	const result = evaluate(
		{
			eventName: context.eventName,
			ref: context.ref,
			sha: context.sha,
			actor: context.actor,
			repository: `${context.repo.owner}/${context.repo.repo}`,
			payload: context.payload as EventContext["payload"],
		},
		defaultBranch,
	);

	core.setOutput("commit-sha", result.commitSha);
	core.setOutput("mode", result.mode);
	core.setOutput("trusted", String(result.trusted));

	core.info(`Event: ${context.eventName}`);
	core.info(`Commit SHA: ${result.commitSha}`);
	core.info(`Mode: ${result.mode}`);

	if (!result.trusted) {
		core.notice(
			"Pull requests from forks and Dependabot cannot use credentials, skipping credentialed jobs",
		);
	}

	core.info(`Trusted: ${String(result.trusted)}`);
} catch (error: unknown) {
	core.setFailed(error instanceof Error ? error.message : String(error));
}
