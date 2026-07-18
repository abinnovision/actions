import {
	buildDownloadUrl,
	resolveVersion,
} from "@internal/action-tool-installer";

import type {
	OctokitType,
	ToolConfig,
	ToolResolution,
	ResolveContext,
} from "@internal/action-tool-installer";

export type { OctokitType, ToolConfig, ToolResolution, ResolveContext };

export const TOOL: ToolConfig = {
	name: "oidc-token-cli",
	archiveType: "tar",
	async resolve(input, { octokit, platform, arch }) {
		const owner = "abinnovision";
		const repo = "oidc-token-cli";
		const version = await resolveVersion(octokit, input, { owner, repo });

		const tag = `v${version}`;
		return {
			version,
			downloadUrl: buildDownloadUrl({
				owner,
				repo,
				tag,
				file: `oidc-token-cli_${platform}_${arch}.tar.gz`,
			}),
		};
	},
};
