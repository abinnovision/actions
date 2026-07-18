import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import { installTool } from "@internal/action-tool-installer";

import { TOOLS } from "./tools.js";

(async () => {
	const token = core.getInput("github-token", { required: true });
	const octokit = getOctokit(token);

	// Install all enabled tools.
	await Promise.all(
		TOOLS.map((tool) =>
			installTool(tool, core.getInput(tool.name), {
				octokit,
				token,
				namespace: "setup-k8s-tools",
			}),
		),
	);
})().catch((error: unknown) => {
	core.error(error instanceof Error ? error : String(error));
	core.setFailed("Error while setting up k8s tools");
});
