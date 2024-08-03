// Chalk does not work by default on GitHub Actions (https://github.com/chalk/supports-color/issues/106).
import commitlintConfig from "@abinnovision/commitlint-config";
import * as core from "@actions/core";
import { getOctokit, context } from "@actions/github";
import { execute as executeRule } from "@commitlint/execute-rule";
import format from "@commitlint/format";
import lint from "@commitlint/lint";
import chalk from "chalk";
// @ts-ignore
import * as createParserOpts from "conventional-changelog-conventionalcommits";

import type {
	QualifiedConfig,
	QualifiedRules,
	LintOutcome,
} from "@commitlint/types";

process.env["FORCE_COLOR"] = "2";

type OctokitType = ReturnType<typeof getOctokit>;

interface CommitRange {
	from?: string;
	to: string;
}

interface CommitInfo {
	sha: string;
	message: string;
}

type CommitLintResult = CommitInfo & {
	result: LintOutcome;
};

const GIT_EMPTY_SHA = "0000000000000000000000000000000000000000";
const PULL_REQUEST_EVENT_NAMES = ["pull_request", "pull_request_target"];

function setupOctokit(): OctokitType {
	return getOctokit(core.getInput("token"));
}

async function resolveConfigRules(): Promise<QualifiedConfig["rules"]> {
	let rules: QualifiedConfig["rules"] = {};

	if (commitlintConfig.rules) {
		rules = (
			await Promise.all(
				Object.entries(commitlintConfig.rules).map((it) => executeRule(it))
			)
		).reduce<QualifiedRules>((registry, item) => {
			const [key, value] = item!;
			registry[key] = value;
			return registry;
		}, {});
	}

	return rules;
}

/**
 * Returns the commit range for the current event.
 *
 * @param octokit Octokit to access the GitHub API.
 */
async function getCommitRange(octokit: OctokitType): Promise<CommitRange> {
	core.debug(`Detecting commit range for event '${context.eventName}'`);

	if (PULL_REQUEST_EVENT_NAMES.includes(context.eventName)) {
		core.debug(`Detected an pull request related event (${context.eventName})`);

		// Fetch the PullRequest object.
		const pullRequest = await octokit.rest.pulls.get({
			owner: context.repo.owner,
			repo: context.repo.repo,
			pull_number: context.issue.number,
		});

		// The range is based on the base and head of the PullRequest.
		return {
			from: pullRequest.data.base?.sha,
			to: pullRequest.data.head.sha,
		};
	} else {
		let fromSha: string | undefined;

		core.debug(
			`Detected an event which is not related to a pull request (${context.eventName})`
		);

		// Check if the event payload has a 'before' field.
		// Usually the 'before' contains a commit sha.
		if (context.payload?.before) {
			const beforeSha = context.payload?.before;

			// Check if before is an empty commit.
			if (beforeSha !== GIT_EMPTY_SHA) {
				core.debug(`Event payload provided a before sha '${beforeSha}'`);
				fromSha = beforeSha;
			} else {
				core.debug(
					`Event payload provided a before sha '${beforeSha}', which is not a valid commit`
				);
			}
		} else {
			core.debug("Event payload does not provide a before sha");
		}

		return {
			from: fromSha,
			to: context.sha,
		};
	}
}

/**
 * Will fetch all commits within the given range. The 'from' might be omitted from the range,
 * if that's the case just the 'to' commit will be fetched.
 *
 * @param octokit Octokit to access the GitHub API.
 * @param range The range of commits to fetch.
 */
async function fetchCommits(
	octokit: OctokitType,
	range: CommitRange
): Promise<CommitInfo[]> {
	if (range.from && range.to) {
		core.debug(`Fetching commits from '${range.from}' to '${range.to}'`);

		const response = await octokit.rest.repos.compareCommits({
			owner: context.repo.owner,
			repo: context.repo.repo,
			base: range.from,
			head: range.to,
		});

		core.debug(`Fetched ${response.data.commits} commits from the given range`);

		return response.data.commits.map((commit) => ({
			sha: commit.sha,
			message: commit.commit.message,
		}));
	} else {
		core.debug(`Fetching commit '${range.to}'`);

		const response = await octokit.rest.repos.getCommit({
			owner: context.repo.owner,
			repo: context.repo.repo,
			ref: range.to,
		});

		return [
			{
				sha: response.data.sha,
				message: response.data.commit.message,
			},
		];
	}
}

/**
 * Will validate the given commits based on the given rules.
 * @param rules Rules to validate against.
 * @param commits The commits to lint.
 */
async function lintCommits(
	rules: QualifiedRules,
	commits: CommitInfo[]
): Promise<CommitLintResult[]> {
	return await Promise.all(
		commits.map(async (commit) => ({
			...commit,
			result: await lint(commit.message, rules, {
				parserOpts: (await createParserOpts())["conventionalChangelog"]
					.parserOpts,
			}),
		}))
	);
}

function hasLintWarnings(results: CommitLintResult[]): boolean {
	return results.some(
		(it) => it.result.warnings && it.result.warnings.length > 0
	);
}

function hasLintErrors(results: CommitLintResult[]): boolean {
	return results.some((it) => !it.result.valid && it.result.errors.length > 0);
}

(async function () {
	const octokit = setupOctokit();

	// Calculate the range of commits which need to be linted.
	const range = await getCommitRange(octokit);

	core.info(`Commit range to lint: ${range.from ?? ""}...${range.to}`);

	// Fetch all commits from the previously calculate range.
	const commits = await fetchCommits(octokit, range);

	await core.group("Commits to lint:", async () => {
		core.info(
			commits
				.map((commit) => `${commit.message}\n\n(${chalk.grey(commit.sha)})`)
				.join(`\n${chalk.bold(chalk.grey("----"))}\n`)
		);
	});

	// Lint all commits which have been fetched previously.
	const result = await lintCommits(await resolveConfigRules(), commits);

	if (hasLintErrors(result)) {
		const output = format(
			{ results: result.map((it) => it.result) },
			{ color: true }
		);
		core.setFailed(`There are commits with invalid messages!\n\n${output}`);
	} else if (hasLintWarnings(result)) {
		const output = format(
			{ results: result.map((it) => it.result) },
			{ color: true }
		);
		core.info(`${chalk.blue("There are commits with warnings!")}\n\n${output}`);
	} else {
		core.info(chalk.green(`All commit messages are valid!`));
	}
})().catch((error) => {
	core.error(error);
	return core.setFailed("Error while running action");
});
