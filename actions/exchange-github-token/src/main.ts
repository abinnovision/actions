import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import { installTool } from "@internal/action-tool-installer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { TOOL } from "./tools.js";

const execFileAsync = promisify(execFile);

/**
 * Splits a whitespace-separated input into its individual values.
 */
const splitInput = (name: string): string[] =>
	core.getInput(name).split(/\s+/).filter(Boolean);

/**
 * Builds the resource list, defaulting to the current repository.
 */
const resolveResources = (): string[] => {
	const resources = splitInput("resources");
	const repositories = splitInput("repositories");

	if (repositories.length > 0) {
		core.warning(
			"The 'repositories' input is deprecated; use 'resources' with typed prefixes (repo:/org:/enterprise:) instead.",
		);
	}

	const all = [...resources, ...repositories];
	return all.length > 0 ? all : [process.env.GITHUB_REPOSITORY ?? ""];
};

(async () => {
	const githubToken = core.getInput("github-token", { required: true });
	await installTool(TOOL, core.getInput("oidc-token-cli-version"), {
		octokit: getOctokit(githubToken),
		token: githubToken,
		namespace: "setup-oidc-token-cli",
	});

	const brokerUrl = core.getInput("broker-url", { required: true });
	const args = [
		"--all",
		"--issuer",
		brokerUrl,
		"--client-id",
		"gh-token-broker",
		"--grant-type",
		"token-exchange",
		"--subject-token-source",
		"github-actions",
		"--audience",
		core.getInput("audience") || brokerUrl,
		"--scope",
		splitInput("scope").join(" "),
		...resolveResources().flatMap((resource) => ["--resource", resource]),
	];

	// Capture stdout without echoing it, since it contains the token.
	const { stdout, stderr } = await execFileAsync("oidc-token", args).catch(
		(error: unknown) => {
			const stderr = (error as { stderr?: string }).stderr;
			if (stderr) {
				core.info(stderr);
			}

			throw error;
		},
	);

	if (stderr) {
		core.info(stderr);
	}

	let response: {
		access_token?: string;
		app_name?: string;
		app_email?: string;
	};
	try {
		response = JSON.parse(stdout) as typeof response;
	} catch {
		// Avoid surfacing the raw output, which may contain the token.
		throw new Error("oidc-token --all returned invalid JSON");
	}

	if (!response.access_token) {
		throw new Error("oidc-token --all did not return an access_token");
	}

	core.setSecret(response.access_token);
	core.saveState("token", response.access_token);

	core.setOutput("token", response.access_token);
	core.setOutput("committer-name", response.app_name ?? "");
	core.setOutput("committer-email", response.app_email ?? "");
})().catch((error: unknown) => {
	core.error(error instanceof Error ? error : String(error));
	core.setFailed("Error while exchanging GitHub token");
});
