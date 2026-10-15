import * as core from "@actions/core";
import { main } from "@tallyrelease/cli";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { cliVersion, parseArgs, withOut, withPin } from "./args.js";

void (async () => {
	core.info(`tallyrelease ${cliVersion}`);
	core.setOutput("cli-version", cliVersion);

	const token = core.getInput("token");
	const { args, out } = withOut(
		withPin(parseArgs(core.getInput("args", { required: true })), cliVersion),
		process.env["RUNNER_TEMP"] ?? tmpdir(),
	);
	const exitCode = await main(args, {
		env: { ...process.env, ...(token ? { GITHUB_TOKEN: token } : {}) },
		cwd: process.cwd(),
		stdout: process.stdout,
		stderr: process.stderr,
	});

	// Also after a failure: shadow --strict writes the report before it exits 1.
	if (out !== undefined) {
		const file = path.resolve(out);
		if (existsSync(file)) {
			core.setOutput("result-file", file);
			core.setOutput("result", readFileSync(file, "utf8").trim());
		}
	}
	if (exitCode !== 0) {
		core.setFailed(`tallyrelease exited with code ${String(exitCode)}`);
	}
})().catch((error: unknown) => {
	core.setFailed(error instanceof Error ? error.message : String(error));
});
