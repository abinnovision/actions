import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { GitHub, Manifest } from "release-please";
import { parseConventionalCommits } from "release-please/commit";
import { BranchName } from "release-please/util/branch-name";
import { filterCommits } from "release-please/util/filter-commits";

import type { CreatedRelease, Strategy } from "release-please";

interface VersionEntry {
	version: string;
	packageVersion: string;
	type: "release" | "prerelease";
	sha: string;
}

type VersionsMap = Record<string, VersionEntry>;

interface PrereleaseOptions {
	token: string;
	manifest: Manifest;
	resolvedBranch: string;
	channel: string;
	shortSha: string;
	existingVersions: VersionsMap;
	commitsPerPath: Record<string, Array<{ sha: string; message: string }>>;
}

/**
 * Parse and validate action inputs. Returns the token, prerelease channel, and target branch.
 */
const parseInputs = () => {
	const token = core.getInput("token", { required: true });

	const prereleaseChannel = core.getInput("prerelease-channel", {
		trimWhitespace: true,
	});

	const targetBranch = core.getInput("target-branch", { trimWhitespace: true });

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
			core.info(`  PR #${String(pr.number)}: ${pr.title}`);
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
const extractStableVersions = (
	releases: CreatedRelease[],
	shortSha: string,
): VersionsMap => {
	const versions: VersionsMap = {};
	for (const release of releases) {
		const path = release.path || ".";
		const packageVersion = release.version;
		const version = `${packageVersion}+${shortSha}`;
		versions[path] = {
			version,
			packageVersion,
			type: "release",
			sha: shortSha,
		};
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
 * Access Manifest._commitsPerPath which is populated by buildPullRequests()
 * during createPullRequests(). Contains per-component commits since last release,
 * already split by path and filtered by CommitExclude.
 */
const getCommitsPerPath = (
	manifest: Manifest,
): Record<string, Array<{ sha: string; message: string }>> =>
	(
		manifest as unknown as {
			_commitsPerPath: Record<string, Array<{ sha: string; message: string }>>;
		}
	)._commitsPerPath;

/**
 * Fetch .release-please-manifest.json from a given branch via the GitHub API.
 * Returns the parsed manifest or null if the branch/file does not exist.
 */
const fetchManifestFromBranch = async (options: {
	token: string;
	owner: string;
	repo: string;
	branch: string;
}): Promise<Record<string, string> | null> => {
	try {
		const response = await getOctokit(options.token).rest.repos.getContent({
			owner: options.owner,
			repo: options.repo,
			path: ".release-please-manifest.json",
			ref: options.branch,
		});

		if (!("content" in response.data) || !response.data.content) {
			return null;
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return JSON.parse(
			Buffer.from(response.data.content, "base64").toString("utf-8"),
		);
	} catch {
		return null;
	}
};

/**
 * Build the set of PR branch names that release-please would create,
 * using the Manifest's separatePullRequests flag and each strategy's
 * branch component — the same logic release-please uses internally.
 */
const buildPrBranchNames = async (
	manifest: Manifest,
	strategiesByPath: Record<string, Strategy>,
	resolvedBranch: string,
): Promise<string[]> => {
	const separatePullRequests = (
		manifest as unknown as { separatePullRequests: boolean }
	).separatePullRequests;

	const branches: string[] = [];

	// Aggregated mode: single branch for all components (Merge plugin active).
	if (!separatePullRequests) {
		branches.push(BranchName.ofTargetBranch(resolvedBranch).toString());
	} else {
		// Separate PR mode: one branch per component.
		for (const [, strategy] of Object.entries(strategiesByPath)) {
			const branchComponent = await strategy.getBranchComponent();
			const branchName = branchComponent
				? BranchName.ofComponentTargetBranch(branchComponent, resolvedBranch)
				: BranchName.ofTargetBranch(resolvedBranch);
			branches.push(branchName.toString());
		}
	}

	// Add group branches from linked-versions plugins.
	// The linked-versions plugin merges linked components into a single PR on a
	// group branch (release-please--branches--{branch}--groups--{groupName}).
	// Without this, prerelease computation misses linked packages that have no
	// direct commits but are version-synchronized by the plugin.
	const plugins = (
		manifest as unknown as {
			plugins: Array<{ groupName?: string }>;
		}
	).plugins;
	for (const plugin of plugins) {
		if (plugin.groupName) {
			branches.push(
				BranchName.ofGroupTargetBranch(
					plugin.groupName,
					resolvedBranch,
				).toString(),
			);
		}
	}

	return [...new Set(branches)]; // deduplicate
};

/**
 * Build a prerelease VersionEntry from structured components.
 */
const buildPrereleaseEntry = (options: {
	baseVersion: string;
	channel: string;
	commitCount: number;
	sha: string;
}): VersionEntry => {
	const packageVersion = `${options.baseVersion}-${options.channel}.${String(options.commitCount)}`;
	return {
		version: `${packageVersion}+${options.sha}`,
		packageVersion,
		type: "prerelease",
		sha: options.sha,
	};
};

/**
 * Fetch the release-please manifest from all candidate PR branches and return
 * only the entries that differ from the currently released versions.
 */
const fetchChangedManifestEntries = async (options: {
	token: string;
	manifest: Manifest;
	strategiesByPath: Record<string, Strategy>;
	resolvedBranch: string;
}): Promise<Record<string, string>> => {
	const { token, manifest, strategiesByPath, resolvedBranch } = options;
	const { owner, repo } = context.repo;

	const prBranchNames = await buildPrBranchNames(
		manifest,
		strategiesByPath,
		resolvedBranch,
	);

	core.info(`PR branches to check: ${prBranchNames.join(", ")}`);

	const currentVersions = manifest.releasedVersions;
	const changed: Record<string, string> = {};

	for (const branch of prBranchNames) {
		const branchManifest = await fetchManifestFromBranch({
			token,
			owner,
			repo,
			branch,
		});

		if (branchManifest) {
			core.info(`  Found manifest on branch: ${branch}`);
			for (const [path, version] of Object.entries(branchManifest)) {
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				if (currentVersions[path]?.toString() !== version) {
					changed[path] = version;
				}
			}
		} else {
			core.info(`  No manifest on branch: ${branch}`);
		}
	}

	return changed;
};

/**
 * Synchronize prerelease versions for linked-version groups.
 * The linked-versions plugin ensures all group members share the same base
 * version in release PRs. Mirror that for prerelease: if any group member
 * received a prerelease version, all other members get the same version,
 * using the highest commit count and most recent SHA from the group.
 */
const syncLinkedPrereleaseVersions = async (options: {
	manifest: Manifest;
	strategiesByPath: Record<string, Strategy>;
	versions: VersionsMap;
	channel: string;
}): Promise<void> => {
	const { manifest, strategiesByPath, versions, channel } = options;
	const plugins = (
		manifest as unknown as {
			plugins: Array<{ groupName?: string; components?: Set<string> }>;
		}
	).plugins;

	for (const plugin of plugins) {
		if (!plugin.components) {
			continue;
		}

		const groupLabel = plugin.groupName ?? "unnamed";

		// Map component names to paths for this linked group.
		const groupPaths: string[] = [];
		for (const [path, strategy] of Object.entries(strategiesByPath)) {
			const component = await strategy.getComponent();
			if (component && plugin.components.has(component)) {
				groupPaths.push(path);
			}
		}

		// Sum the commit counts and find the most recent SHA across all group
		// members. The total commit count reflects the full set of changes to
		// the linked group; the SHA represents the latest state of the codebase.
		let totalCount = 0;
		let latestSha = "";
		let baseVersion = "";
		let hasPrerelease = false;
		for (const path of groupPaths) {
			if (path in versions && versions[path].type === "prerelease") {
				hasPrerelease = true;
				const match = versions[path].packageVersion.match(/\.(\d+)$/);
				const count = match ? parseInt(match[1], 10) : 0;
				totalCount += count;
				if (!latestSha || versions[path].sha.localeCompare(latestSha) > 0) {
					latestSha = versions[path].sha;
				}
				// All linked members share the same base version.
				if (!baseVersion) {
					baseVersion = versions[path].packageVersion.replace(
						new RegExp(`-${channel}\\.\\d+$`),
						"",
					);
				}
			}
		}

		if (!hasPrerelease) {
			continue;
		}

		const syncedEntry = buildPrereleaseEntry({
			baseVersion,
			channel,
			commitCount: totalCount,
			sha: latestSha,
		});

		// Apply the synced version to all group members.
		for (const path of groupPaths) {
			if (!(path in versions)) {
				core.info(
					`  ${path}: synced prerelease from linked group "${groupLabel}" -> ${syncedEntry.version}`,
				);
				versions[path] = { ...syncedEntry };
			} else if (
				versions[path].type === "prerelease" &&
				versions[path].version !== syncedEntry.version
			) {
				core.info(
					`  ${path}: aligned prerelease to linked group "${groupLabel}" -> ${syncedEntry.version}`,
				);
				versions[path] = { ...syncedEntry };
			}
		}
	}
};

/**
 * Compute prerelease versions by diffing the release-please PR branch
 * manifest against the current manifest. Uses the already-loaded Manifest
 * for strategy-based component resolution and tag construction.
 */
const computePrereleaseVersions = async (
	options: PrereleaseOptions,
): Promise<VersionsMap> => {
	const {
		token,
		manifest,
		resolvedBranch,
		channel,
		shortSha,
		existingVersions,
		commitsPerPath,
	} = options;

	const versions = { ...existingVersions };
	const strategiesByPath = await getStrategiesByPath(manifest);

	// Fetch PR branch manifests and find entries that differ from current.
	const changedEntries = await fetchChangedManifestEntries({
		token,
		manifest,
		strategiesByPath,
		resolvedBranch,
	});

	if (Object.keys(changedEntries).length === 0) {
		core.info(
			"No release-please PR branches with manifests found. Skipping prerelease computation.",
		);
		return versions;
	}

	core.startGroup("Manifest comparison");
	core.info(
		`Current: ${JSON.stringify(Object.fromEntries(Object.entries(manifest.releasedVersions).map(([k, v]) => [k, v.toString()])), null, 2)}`,
	);
	core.info(`PR: ${JSON.stringify(changedEntries, null, 2)}`);
	core.endGroup();

	// Compute prerelease version for each changed package.
	for (const [path, nextVersion] of Object.entries(changedEntries)) {
		// Skip packages already covered by a stable release.
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (versions[path]) {
			core.info(`  ${path}: skipped (stable release already computed)`);
			continue;
		}

		const strategy = strategiesByPath[path];
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!strategy) {
			core.warning(`  ${path}: no strategy found, skipping`);
			continue;
		}

		// Get per-component commits already fetched by Manifest.buildPullRequests().
		const pathCommits = commitsPerPath[path] ?? [];

		// Parse conventional commits and filter to changelog-worthy entries only.
		const config = manifest.repositoryConfig[path];
		const parsed = parseConventionalCommits(
			pathCommits.map((c) => ({ sha: c.sha, message: c.message })),
		);
		const commitCount = filterCommits(parsed, config.changelogSections).length;

		// Component-scoped SHA: most recent commit touching this path.
		// Falls back to HEAD SHA for dependency-triggered bumps with no direct commits.
		const componentSha =
			pathCommits.length > 0 && pathCommits[0].sha
				? pathCommits[0].sha.substring(0, 7)
				: shortSha;

		const entry = buildPrereleaseEntry({
			baseVersion: nextVersion,
			channel,
			commitCount,
			sha: componentSha,
		});

		core.info(
			`  ${path}: ${nextVersion} -> ${entry.version} (commits=${String(commitCount)}, sha=${componentSha})`,
		);

		versions[path] = entry;
	}

	// Synchronize prerelease versions for linked-version groups.
	await syncLinkedPrereleaseVersions({
		manifest,
		strategiesByPath,
		versions,
		channel,
	});

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

	// Compute short SHA once for all version computations.
	const shortSha = context.sha.substring(0, 7);

	// Extract stable versions from created releases.
	let versions: VersionsMap = {};
	if (createdReleases.length > 0) {
		versions = extractStableVersions(createdReleases, shortSha);

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
		shortSha,
		existingVersions: versions,
		commitsPerPath: getCommitsPerPath(manifest),
	});

	core.startGroup("Final versions");
	core.info(JSON.stringify(versions, null, 2));
	core.endGroup();

	core.setOutput("versions", JSON.stringify(versions));
})().catch((error: unknown) => {
	core.error(error instanceof Error ? error : String(error));
	core.setFailed("Error while running release-please");
});
