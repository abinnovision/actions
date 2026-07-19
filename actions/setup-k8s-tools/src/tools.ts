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

export const TOOLS: ToolConfig[] = [
	{
		name: "kube-score",
		archiveType: "tar",
		async resolve(input, { octokit, platform, arch }) {
			const owner = "zegl";
			const repo = "kube-score";
			const version = await resolveVersion(octokit, input, {
				owner,
				repo,
				excludeDrafts: true,
				excludePreReleases: true,
			});

			const tag = `v${version}`;
			return {
				version,
				downloadUrl: buildDownloadUrl({
					owner,
					repo,
					tag,
					file: `kube-score_${version}_${platform}_${arch}.tar.gz`,
				}),
			};
		},
	},
	{
		name: "kubeconform",
		archiveType: "tar",
		async resolve(input, { octokit, platform, arch }) {
			const owner = "yannh";
			const repo = "kubeconform";
			const version = await resolveVersion(octokit, input, {
				owner,
				repo,
				excludeDrafts: true,
				excludePreReleases: true,
			});

			const tag = `v${version}`;
			return {
				version,
				downloadUrl: buildDownloadUrl({
					owner,
					repo,
					tag,
					file: `kubeconform-${platform}-${arch}.tar.gz`,
				}),
			};
		},
	},
	{
		name: "kustomize",
		archiveType: "tar",
		async resolve(input, { octokit, platform, arch }) {
			const owner = "kubernetes-sigs";
			const repo = "kustomize";
			const version = await resolveVersion(octokit, input, {
				owner,
				repo,
				excludeDrafts: true,
				excludePreReleases: true,
				tagFilter: (tag) => tag.startsWith("kustomize/v"),
				fromTag: (tag) => tag.replace(/^kustomize\/v/, ""),
			});

			const tag = `kustomize/v${version}`;
			return {
				version,
				downloadUrl: buildDownloadUrl({
					owner,
					repo,
					tag,
					file: `kustomize_v${version}_${platform}_${arch}.tar.gz`,
				}),
			};
		},
	},
	{
		name: "argocd",
		archiveType: "binary",
		async resolve(input, { octokit, platform, arch }) {
			const owner = "argoproj";
			const repo = "argo-cd";
			const version = await resolveVersion(octokit, input, {
				owner,
				repo,
				excludeDrafts: true,
				excludePreReleases: true,
			});

			const tag = `v${version}`;
			const suffix = platform === "windows" ? ".exe" : "";
			return {
				version,
				downloadUrl: buildDownloadUrl({
					owner,
					repo,
					tag,
					file: `argocd-${platform}-${arch}${suffix}`,
				}),
			};
		},
	},
];
