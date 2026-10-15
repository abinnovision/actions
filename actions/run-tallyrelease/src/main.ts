import * as core from "@actions/core";
import { main } from "@tallyrelease/cli";

void (async () => {
	const token = core.getInput("token");
	const exitCode = await main(
		core.getInput("args", { required: true }).split(/\s+/).filter(Boolean),
		{
			env: { ...process.env, ...(token ? { GITHUB_TOKEN: token } : {}) },
			cwd: process.cwd(),
			stdout: process.stdout,
			stderr: process.stderr,
		},
	);
	if (exitCode !== 0) {
		core.setFailed(`tallyrelease exited with code ${String(exitCode)}`);
	}
})().catch((error: unknown) => {
	core.setFailed(error instanceof Error ? error.message : String(error));
});
