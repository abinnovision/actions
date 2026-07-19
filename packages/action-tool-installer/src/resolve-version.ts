import * as semver from "semver";

import type { OctokitType } from "./tools.js";

interface ResolveLatestTagInput {
	owner: string;
	repo: string;
	excludeDrafts: boolean;
	excludePreReleases: boolean;
	tagFilter?: (tag: string) => boolean;
}

const resolveLatestTag = async (
	octokit: OctokitType,
	input: ResolveLatestTagInput,
): Promise<string> => {
	const { data } = await octokit.rest.repos.listReleases({
		owner: input.owner,
		repo: input.repo,
		per_page: 50,
	});

	const release = data.find(
		(r) =>
			(!input.excludeDrafts || !r.draft) &&
			(!input.excludePreReleases || !r.prerelease) &&
			(input.tagFilter?.(r.tag_name) ?? true),
	);
	if (release) {
		return release.tag_name;
	}

	throw new Error(`Could not find a release for ${input.owner}/${input.repo}`);
};

export interface ResolveVersionOptions {
	owner: string;
	repo: string;
	excludeDrafts?: boolean;
	excludePreReleases?: boolean;
	tagFilter?: (tag: string) => boolean;
	// Extracts the bare semver (e.g. "1.2.3") from a concrete git tag when
	// resolving "latest". Defaults to stripping a leading "v".
	fromTag?: (tag: string) => string;
}

export const resolveVersion = async (
	octokit: OctokitType,
	input: string,
	options: ResolveVersionOptions,
): Promise<string> => {
	if (input === "latest") {
		const tag = await resolveLatestTag(octokit, {
			owner: options.owner,
			repo: options.repo,
			excludeDrafts: options.excludeDrafts ?? true,
			excludePreReleases: options.excludePreReleases ?? true,
			tagFilter: options.tagFilter,
		});

		return (options.fromTag ?? ((t) => t.replace(/^v/, "")))(tag);
	}

	if (semver.valid(input) !== input) {
		throw new Error(
			`Invalid version "${input}" for ${options.owner}/${options.repo}. Use "latest" or a bare semver version like "1.2.3".`,
		);
	}

	return input;
};
