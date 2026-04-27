import type { getOctokit } from "@actions/github";

type OctokitType = ReturnType<typeof getOctokit>;

interface ToolResolution {
	version: string;
	downloadUrl: string;
}

interface ResolveContext {
	octokit: OctokitType;
	platform: string;
	arch: string;
}

interface ToolConfig {
	name: string;
	archiveType: "tar" | "zip";
	resolve: (input: string, ctx: ResolveContext) => Promise<ToolResolution>;
}

const resolveLatestTag = async (
	octokit: OctokitType,
	owner: string,
	repo: string,
): Promise<string> => {
	const { data } = await octokit.rest.repos.getLatestRelease({ owner, repo });
	return data.tag_name;
};

const TOOLS: ToolConfig[] = [
	{
		name: "kube-score",
		archiveType: "tar",
		async resolve(input, { octokit, platform, arch }) {
			const tag =
				input === "latest"
					? await resolveLatestTag(octokit, "zegl", "kube-score")
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
					? await resolveLatestTag(octokit, "yannh", "kubeconform")
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
					? await resolveLatestTag(octokit, "kubernetes-sigs", "kustomize")
					: `kustomize/${input}`;
			const version = tag.replace("kustomize/", "");
			return {
				version,
				downloadUrl: `https://github.com/kubernetes-sigs/kustomize/releases/download/${encodeURIComponent(tag)}/kustomize_${version}_${platform}_${arch}.tar.gz`,
			};
		},
	},
];

export type { OctokitType, ToolResolution, ResolveContext, ToolConfig };
export { TOOLS };
