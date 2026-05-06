import { resolveLatestTagCached } from "./latest-tag-cache.js";

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

export const TOOLS: ToolConfig[] = [
	{
		name: "kube-score",
		archiveType: "tar",
		async resolve(input, { octokit, platform, arch }) {
			const tag =
				input === "latest"
					? await resolveLatestTagCached(octokit, {
							cacheId: "kube-score",
							owner: "zegl",
							repo: "kube-score",
						})
					: input;

			const version = tag.replace(/^v/, "");
			return {
				version: tag,
				downloadUrl: `https://github.com/zegl/kube-score/releases/download/${tag}/kube-score_${version}_${platform}_${arch}.tar.gz`,
			};
		},
	},
	{
		name: "kubeconform",
		archiveType: "tar",
		async resolve(input, { octokit, platform, arch }) {
			const tag =
				input === "latest"
					? await resolveLatestTagCached(octokit, {
							cacheId: "kubeconform",
							owner: "yannh",
							repo: "kubeconform",
						})
					: input;

			return {
				version: tag,
				downloadUrl: `https://github.com/yannh/kubeconform/releases/download/${tag}/kubeconform-${platform}-${arch}.tar.gz`,
			};
		},
	},
	{
		name: "kustomize",
		archiveType: "tar",
		async resolve(input, { octokit, platform, arch }) {
			const tag =
				input === "latest"
					? await resolveLatestTagCached(octokit, {
							cacheId: "kustomize",
							owner: "kubernetes-sigs",
							repo: "kustomize",
							tagFilter: (tag) => tag.startsWith("kustomize/v"),
						})
					: `kustomize/${input}`;

			const version = tag.replace("kustomize/", "");
			return {
				version,
				downloadUrl: `https://github.com/kubernetes-sigs/kustomize/releases/download/${encodeURIComponent(tag)}/kustomize_${version}_${platform}_${arch}.tar.gz`,
			};
		},
	},
	{
		name: "argocd",
		archiveType: "binary",
		async resolve(input, { octokit, platform, arch }) {
			const tag =
				input === "latest"
					? await resolveLatestTagCached(octokit, {
							cacheId: "argocd",
							owner: "argoproj",
							repo: "argo-cd",
						})
					: input;

			const suffix = platform === "windows" ? ".exe" : "";
			return {
				version: tag,
				downloadUrl: `https://github.com/argoproj/argo-cd/releases/download/${tag}/argocd-${platform}-${arch}${suffix}`,
			};
		},
	},
];
