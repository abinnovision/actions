import * as core from "@actions/core";
import { main } from "@tallyrelease/cli";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { cliVersion, parseArgs, withOut, withPin } from "./args.js";
import { parseGithubOutput } from "./outputs.js";

void (async () => {
	core.info(`tallyrelease ${cliVersion}`);
	core.setOutput("cli-version", cliVersion);

	const token = core.getInput("token");
	const tempDir = process.env["RUNNER_TEMP"] ?? tmpdir();
	const { args, out } = withOut(
		withPin(parseArgs(core.getInput("args", { required: true })), cliVersion),
		tempDir,
	);
	// The CLI writes to a private file so outputs can be re-emitted and `releases` also saved as a file.
	const outputFile = path.join(
		tempDir,
		`tallyrelease-github-output-${randomUUID()}`,
	);
	writeFileSync(outputFile, "");
	const exitCode = await main(args, {
		env: {
			...process.env,
			GITHUB_OUTPUT: outputFile,
			...(token ? { GITHUB_TOKEN: token } : {}),
		},
		cwd: process.cwd(),
		stdout: process.stdout,
		stderr: process.stderr,
	});

	// Also after a failure: the file may be partially written.
	for (const [key, value] of parseGithubOutput(
		readFileSync(outputFile, "utf8"),
	)) {
		core.setOutput(key, value);
		if (key === "releases") {
			const releasesFile = path.join(tempDir, "tallyrelease-releases.json");
			writeFileSync(releasesFile, value);
			core.setOutput("releases-file", releasesFile);
		}
	}

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
