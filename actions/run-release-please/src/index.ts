import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { GitHub, Manifest } from "release-please";
import { BranchName } from "release-please/util/branch-name";
import { TagName } from "release-please/util/tag-name";
import { Version } from "release-please/version";

import type { CreatedRelease, Strategy } from "release-please";

interface VersionEntry {
	version: string;
	tag: string;
	type: "release" | "prerelease";
}

type VersionsMap = Record<string, VersionEntry>;

interface PrereleaseOptions {
	token: string;
	manifest: Manifest;
	resolvedBranch: string;
	channel: string;
	existingVersions: VersionsMap;
}

/**
 * Parse and validate action inputs. Returns the token, prerelease channel, and target branch.
 */
const parseInputs = () => {
	const token = core.getInput("token", { required: true });

	const prereleaseChannel =
		core.getInput("prerelease-channel", { trimWhitespace: true }) ?? "";

	const targetBranch =
		core.getInput("target-branch", { trimWhitespace: true }) ?? "";

	return { token, prereleaseChannel, targetBranch };
};

/**
 * Resolve the target branch. If not provided, fetch the default branch
 * from the GitHub API.
 */
const resolveTargetBranch = async (
	token: string,
	targetBranch: string,
): Promise<string> => {
	if (targetBranch) {
		return targetBranch;
	}

	// No target branch provided, fetch default branch from GitHub API.
	const octokit = getOctokit(token);
	const { data } = await octokit.rest.repos.get({
		owner: context.repo.owner,
		repo: context.repo.repo,
	});

	return data.default_branch;
};

/**
 * Run release-please: create GitHub releases for merged PRs, then
 * create/update release PRs for pending changes.
 *
 * Returns the list of created releases (maybe empty).
 */
const runReleasePlease = async (
	manifest: Manifest,
): Promise<CreatedRelease[]> => {
	// Create releases first (for merged release PRs), matching release-please-action order.
	core.info("Running release-please: createReleases()");
	const releaseResults = await manifest.createReleases();
	const createdReleases = releaseResults.filter(
		(r): r is CreatedRelease => r !== undefined,
	);

	core.startGroup("Created releases");
	for (const release of createdReleases) {
		core.info(`  ${release.path}: ${release.version} (tag=${release.tagName})`);
	}

	if (createdReleases.length === 0) {
		core.info("  (none)");
	}

	core.endGroup();

	// Create/update release PRs for pending changes.
	core.info("Running release-please: createPullRequests()");
	const pullRequests = await manifest.createPullRequests();

	core.startGroup("Pull requests");
	for (const pr of pullRequests) {
		if (pr) {
			core.info(`  PR #${pr.number}: ${pr.title}`);
		}
	}

	if (pullRequests.filter(Boolean).length === 0) {
		core.info("  (none)");
	}

	core.endGroup();

	return createdReleases;
};

/**
 * Extract stable versions from created releases.
 */
const extractStableVersions = (releases: CreatedRelease[]): VersionsMap => {
	const versions: VersionsMap = {};
	for (const release of releases) {
		const path = release.path || ".";
		const version = release.version;
		versions[path] = { version, tag: version, type: "release" };
	}

	return versions;
};

/**
 * Access Manifest.getStrategiesByPath() which is TS-private but accessible at JS runtime.
 * Isolated here to keep the type assertion in one place.
 */
const getStrategiesByPath = (
	manifest: Manifest,
): Promise<Record<string, Strategy>> =>
	(
		manifest as unknown as {
			getStrategiesByPath: () => Promise<Record<string, Strategy>>;
		}
	).getStrategiesByPath();

/**
 * Compute prerelease versions by diffing the release-please PR branch
 * manifest against the current manifest. Uses the already-loaded Manifest
 * for strategy-based component resolution and tag construction.
 */
const computePrereleaseVersions = async (
	options: PrereleaseOptions,
): Promise<VersionsMap> => {
	const { token, manifest, resolvedBranch, channel, existingVersions } =
		options;

	const { owner, repo } = context.repo;
	const versions = { ...existingVersions };

	const strategiesByPath = await getStrategiesByPath(manifest);

	// Determine the release-please PR branch using release-please's own BranchName.
	const prBranch = BranchName.ofTargetBranch(resolvedBranch).toString();
	core.info(`PR branch: ${prBranch}`);

	// Fetch PR manifest from the release-please branch via GitHub API.
	let prManifest: Record<string, string>;
	try {
		const response = await getOctokit(token).rest.repos.getContent({
			owner,
			repo,
			path: ".release-please-manifest.json",
			ref: prBranch,
		});

		if (!("content" in response.data) || !response.data.content) {
			core.info("PR manifest has no content. Skipping prerelease computation.");
			return versions;
		}

		prManifest = JSON.parse(
			Buffer.from(response.data.content, "base64").toString("utf-8"),
		);
	} catch {
		core.info(
			`Release-please PR branch '${prBranch}' does not exist or has no manifest. Skipping prerelease computation.`,
		);

		return versions;
	}

	// Use the manifest's already-loaded released versions (from .release-please-manifest.json).
	const currentVersions = manifest.releasedVersions;

	core.startGroup("Manifest comparison");
	core.info(
		`Current: ${JSON.stringify(Object.fromEntries(Object.entries(currentVersions).map(([k, v]) => [k, v.toString()])), null, 2)}`,
	);
	core.info(`PR: ${JSON.stringify(prManifest, null, 2)}`);
	core.endGroup();

	// Diff manifests to find changed packages.
	const changedPackages: Record<string, { current: string; next: string }> = {};
	for (const [path, nextVersion] of Object.entries(prManifest)) {
		const currentVersion = currentVersions[path]?.toString();
		if (currentVersion !== nextVersion) {
			changedPackages[path] = {
				current: currentVersion,
				next: nextVersion,
			};
		}
	}

	core.startGroup("Changed packages");
	core.info(JSON.stringify(changedPackages, null, 2));
	core.endGroup();

	const octokit = getOctokit(token);
	const shortSha = context.sha.substring(0, 7);

	// Lazily resolved genesis commit SHA — used as fallback base when a release tag doesn't exist.
	let genesisCommitSha: string | undefined;

	// Compute prerelease version for each changed package.
	for (const [
		path,
		{ current: currentVersion, next: nextVersion },
	] of Object.entries(changedPackages)) {
		// Skip packages already covered by a stable release.
		if (versions[path]) {
			core.info(`  ${path}: skipped (stable release already computed)`);
			continue;
		}

		const strategy = strategiesByPath[path];
		if (!strategy) {
			core.warning(`  ${path}: no strategy found, skipping`);
			continue;
		}

		// Get component via strategy -> handles normalization per release-type
		const component = await strategy.getComponent();

		// Get tag config from repositoryConfig (public, properly merged).
		const config = manifest.repositoryConfig[path];

		// Construct last release tag using release-please's TagName.
		const lastVersion = Version.parse(currentVersion);

		const lastTag = new TagName(
			lastVersion,
			component || undefined,
			config.tagSeparator,
			config.includeVInTag,
		);

		const lastTagStr = lastTag.toString();

		// Count commits since the last release tag via GitHub API.
		let commitCount: number;
		try {
			const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
				owner,
				repo,
				basehead: `${lastTagStr}...${context.sha}`,
			});

			commitCount = data.ahead_by;
		} catch {
			// Tag doesn't exist... resolve genesis commit and compare from there.
			if (!genesisCommitSha) {
				const { headers, data } = await octokit.rest.repos.listCommits({
					owner,
					repo,
					sha: context.sha,
					per_page: 1,
				});

				const lastPageMatch = headers.link?.match(/page=(\d+)>; rel="last"/);

				if (lastPageMatch) {
					const lastPage = parseInt(lastPageMatch[1], 10);
					const { data: lastPageData } = await octokit.rest.repos.listCommits({
						owner,
						repo,
						sha: context.sha,
						per_page: 1,
						page: lastPage,
					});
					genesisCommitSha = lastPageData[0].sha;
				} else {
					// Only one page — the first commit is the genesis commit.
					genesisCommitSha = data[0].sha;
				}
			}

			const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
				owner,
				repo,
				basehead: `${genesisCommitSha}...${context.sha}`,
			});
			// ahead_by doesn't include the base commit itself, so add 1.
			commitCount = data.ahead_by + 1;
		}

		// Build prerelease version and docker-compatible tag.
		const version = `${nextVersion}-${channel}.${commitCount}+${shortSha}`;
		const tag = version.replace(/\+/g, "-");

		core.info(
			`  ${path}: ${currentVersion} -> ${version} (component=${component}, lastTag=${lastTagStr}, commits=${commitCount})`,
		);

		versions[path] = { version, tag, type: "prerelease" };
	}

	return versions;
};

/**
 * Main entry point: parse inputs, resolve target branch, run release-please to create releases and PRs,
 */
(async () => {
	const { token, prereleaseChannel, targetBranch } = parseInputs();

	const { owner, repo } = context.repo;
	core.info(`repository: ${owner}/${repo}`);
	core.info(`prerelease-channel=${prereleaseChannel || "<none>"}`);

	// Resolve target branch.
	const resolvedBranch = await resolveTargetBranch(token, targetBranch);
	core.info(`target-branch=${resolvedBranch}`);

	// Create release-please GitHub instance and load manifest from repo config.
	const github = await GitHub.create({
		owner,
		repo,
		token,
		defaultBranch: resolvedBranch,
	});

	const manifest = await Manifest.fromManifest(github, resolvedBranch);

	// Run release-please (create releases + create/update PRs).
	const createdReleases = await runReleasePlease(manifest);

	// Extract stable versions from created releases.
	let versions: VersionsMap = {};
	if (createdReleases.length > 0) {
		versions = extractStableVersions(createdReleases);

		core.startGroup("Computed stable versions");
		core.info(JSON.stringify(versions, null, 2));
		core.endGroup();
	}

	// If no prerelease channel, output and exit.
	if (!prereleaseChannel) {
		core.info("No prerelease channel configured");
		core.setOutput("versions", JSON.stringify(versions));
		return;
	}

	// Compute prerelease versions using the already-loaded manifest.
	core.info(`Computing prerelease versions (channel=${prereleaseChannel})`);
	versions = await computePrereleaseVersions({
		token,
		manifest,
		resolvedBranch,
		channel: prereleaseChannel,
		existingVersions: versions,
	});

	core.startGroup("Final versions");
	core.info(JSON.stringify(versions, null, 2));
	core.endGroup();

	core.setOutput("versions", JSON.stringify(versions));
})().catch((error) => {
	core.error(error);
	core.setFailed("Error while running release-please");
});
