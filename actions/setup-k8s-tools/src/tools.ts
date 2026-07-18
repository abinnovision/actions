import { resolveLatestTagCached } from "@internal/action-tool-installer";

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
			const tag =
				input === "latest"
					? await resolveLatestTagCached(octokit, {
							cacheId: "kube-score",
							owner: "zegl",
							repo: "kube-score",
							namespace: "setup-k8s-tools",
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
							namespace: "setup-k8s-tools",
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
							namespace: "setup-k8s-tools",
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
							namespace: "setup-k8s-tools",
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
