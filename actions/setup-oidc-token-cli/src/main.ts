import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import { installTool } from "@internal/action-tool-installer";

import { TOOL } from "./tools.js";

(async () => {
	const token = core.getInput("github-token", { required: true });
	const octokit = getOctokit(token);

	const version = await installTool(TOOL, core.getInput("version"), {
		octokit,
		token,
		namespace: "setup-oidc-token-cli",
	});

	core.setOutput("version", version ?? "");
})().catch((error: unknown) => {
	core.error(error instanceof Error ? error : String(error));
	core.setFailed("Error while setting up oidc-token-cli");
});
