import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import type { OctokitType, ToolConfig } from "./tools.js";

interface InstallContext {
	octokit: OctokitType;
	token: string;
}

const mapPlatform = (platform: string): string => {
	const map: Record<string, string> = {
		linux: "linux",
		darwin: "darwin",
		win32: "windows",
	};

	return map[platform] ?? platform;
};

const mapArch = (arch: string): string => {
	const map: Record<string, string> = {
		x64: "amd64",
		arm64: "arm64",
	};

	return map[arch] ?? arch;
};

export const installTool = async (
	config: ToolConfig,
	input: string,
	ctx: InstallContext,
): Promise<void> => {
	if (!input) {
		core.setOutput(`${config.name}-version`, "");
		return;
	}

	const platform = mapPlatform(process.platform);
	const arch = mapArch(process.arch);

	const { version, downloadUrl } = await config.resolve(input, {
		octokit: ctx.octokit,
		platform,
		arch,
	});

	// Layer 1: tool cache - same-run reuse and self-hosted runners.
	const tcPath = tc.find(config.name, version);
	if (tcPath) {
		core.info(`${config.name} ${version} restored from tool cache`);
		core.addPath(tcPath);
		core.setOutput(`${config.name}-version`, version);
		return;
	}

	// Layer 2: actions cache - persists across runs on all runner types.
	const cacheKey = `setup-k8s-tools-${config.name}-${version}-${platform}-${arch}`;
	const restorePath = path.join(
		process.env["RUNNER_TEMP"] ?? os.tmpdir(),
		"setup-k8s-tools",
		config.name,
		version,
	);

	const activate = async (sourcePath: string): Promise<void> => {
		const cachedDir = await tc.cacheDir(sourcePath, config.name, version);
		core.addPath(cachedDir);
		core.setOutput(`${config.name}-version`, version);
	};

	const restoredKey = await cache.restoreCache([restorePath], cacheKey);
	if (restoredKey) {
		core.info(`${config.name} ${version} restored from actions cache`);
		await activate(restorePath);
		return;
	}

	// Download, extract, populate both cache layers.
	core.info(`Downloading ${config.name} ${version}`);
	const downloaded = await tc.downloadTool(
		downloadUrl,
		undefined,
		`Bearer ${ctx.token}`,
	);

	let extractedPath: string;
	if (config.archiveType === "binary") {
		const binName = platform === "windows" ? `${config.name}.exe` : config.name;
		const binDir = path.join(
			process.env["RUNNER_TEMP"] ?? os.tmpdir(),
			"setup-k8s-tools",
			config.name,
			version,
			"bin",
		);
		await fs.mkdir(binDir, { recursive: true });
		const dest = path.join(binDir, binName);
		await fs.copyFile(downloaded, dest);
		if (platform !== "windows") {
			await fs.chmod(dest, 0o755);
		}
		extractedPath = binDir;
	} else {
		extractedPath =
			config.archiveType === "tar"
				? await tc.extractTar(downloaded)
				: await tc.extractZip(downloaded);
	}

	try {
		await cache.saveCache([extractedPath], cacheKey);
	} catch (err) {
		core.warning(
			err instanceof Error ? err.message : "Failed to save to actions cache",
		);
	}

	await activate(extractedPath);
	core.info(`${config.name} ${version} installed`);
};
