import { describe, expect, it } from "vitest";

import { evaluate } from "./evaluate.js";

import type { EventContext } from "./evaluate.js";

const base: EventContext = {
	eventName: "push",
	ref: "refs/heads/main",
	sha: "push-sha",
	actor: "octocat",
	repository: "org/repo",
	payload: {},
};

const pullRequest = (fullName: string): EventContext["payload"] => ({
	pull_request: { head: { sha: "pr-sha", repo: { full_name: fullName } } },
});

describe("evaluate", () => {
	it.each([
		{
			name: "push to the default branch",
			ctx: {},
			expected: { commitSha: "push-sha", mode: "main", trusted: true },
		},
		{
			name: "push to another branch",
			ctx: { ref: "refs/heads/feature" },
			expected: { commitSha: "push-sha", mode: "none", trusted: true },
		},
		{
			name: "pull request from the same repository",
			ctx: { eventName: "pull_request", payload: pullRequest("org/repo") },
			expected: { commitSha: "pr-sha", mode: "pr", trusted: true },
		},
		{
			name: "pull request from a fork",
			ctx: { eventName: "pull_request", payload: pullRequest("fork/repo") },
			expected: { commitSha: "pr-sha", mode: "pr", trusted: false },
		},
		{
			name: "pull request from Dependabot",
			ctx: {
				eventName: "pull_request",
				actor: "dependabot[bot]",
				payload: pullRequest("org/repo"),
			},
			expected: { commitSha: "pr-sha", mode: "pr", trusted: false },
		},
		{
			name: "merge group",
			ctx: {
				eventName: "merge_group",
				ref: "refs/heads/gh-readonly-queue/main/pr-1",
				payload: { merge_group: { head_sha: "queue-sha" } },
			},
			expected: { commitSha: "queue-sha", mode: "none", trusted: true },
		},
	])("$name", ({ ctx, expected }) => {
		expect(evaluate({ ...base, ...ctx }, "main")).toEqual(expected);
	});

	it("rejects pull_request_target", () => {
		expect(() =>
			evaluate({ ...base, eventName: "pull_request_target" }, "main"),
		).toThrow(
			"'pull_request_target' is not supported. Switch the caller to 'pull_request'.",
		);
	});
});
