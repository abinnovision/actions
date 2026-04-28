import * as core from "@actions/core";
import { getOctokit } from "@actions/github";

import { installTool } from "./install.js";
import { TOOLS } from "./tools.js";

(async () => {
	const token = core.getInput("github-token", { required: true });
	const octokit = getOctokit(token);

	for (const tool of TOOLS) {
		// eslint-disable-next-line no-await-in-loop
		await installTool(tool, core.getInput(tool.name), { octokit, token });
	}
})().catch((error: unknown) => {
	core.error(error instanceof Error ? error : String(error));
	core.setFailed("Error while setting up k8s tools");
});
