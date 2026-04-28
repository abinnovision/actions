import type { getOctokit } from "@actions/github";

const resolveLatestTag = async (
	octokit: OctokitType,
	input: { owner: string; repo: string; tagFilter?: (tag: string) => boolean },
): Promise<string> => {
	const { data } = await octokit.rest.repos.listReleases({
		owner: input.owner,
		repo: input.repo,
		per_page: 50,
	});

	// If a tagFilter is provided, find the first release that matches the filter. Otherwise, take the first release.
	const release = data.find((r) => input.tagFilter?.(r.tag_name) ?? true);
	if (release) {
		return release.tag_name;
	}

	throw new Error(`Could not find a release for ${input.owner}/${input.repo}`);
};

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
	archiveType: "tar" | "zip";
	resolve: (input: string, ctx: ResolveContext) => Promise<ToolResolution>;
}

export const TOOLS: ToolConfig[] = [
	{
		name: "kube-score",
		archiveType: "tar",
		async resolve(input, { octokit, platform, arch }) {
			const tag =
				input === "latest"
					? await resolveLatestTag(octokit, {
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
					? await resolveLatestTag(octokit, {
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
					? await resolveLatestTag(octokit, {
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
];
