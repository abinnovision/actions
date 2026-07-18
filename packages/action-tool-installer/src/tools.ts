import type { getOctokit } from "@actions/github";

export type OctokitType = ReturnType<typeof getOctokit>;

export interface ToolResolution {
	version: string;
	downloadUrl: string;
}

export interface ResolveContext {
	octokit: OctokitType;
	platform: string;
	arch: string;
}

export interface ToolConfig {
	name: string;
	archiveType: "tar" | "zip" | "binary";
	resolve: (input: string, ctx: ResolveContext) => Promise<ToolResolution>;
}
