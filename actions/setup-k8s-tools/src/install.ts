import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

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

	const cachedPath = tc.find(config.name, version);
	if (cachedPath) {
		core.info(`${config.name} ${version} restored from cache`);
		core.addPath(cachedPath);
		core.setOutput(`${config.name}-version`, version);
		return;
	}

	core.info(`Downloading ${config.name} ${version}`);
	const downloaded = await tc.downloadTool(
		downloadUrl,
		undefined,
		`Bearer ${ctx.token}`,
	);

	const extractedPath =
		config.archiveType === "tar"
			? await tc.extractTar(downloaded)
			: await tc.extractZip(downloaded);

	const cachedDir = await tc.cacheDir(extractedPath, config.name, version);
	core.addPath(cachedDir);
	core.setOutput(`${config.name}-version`, version);
	core.info(`${config.name} ${version} installed`);
};
