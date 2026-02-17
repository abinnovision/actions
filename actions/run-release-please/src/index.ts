import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { GitHub, Manifest } from "release-please";
import { TagName } from "release-please/build/src/util/tag-name";
import { Version } from "release-please/build/src/version";

import type { CreatedRelease, Strategy } from "release-please";

interface VersionEntry {
	version: string;
	tag: string;
	type: "release" | "prerelease";
}

type VersionsMap = Record<string, VersionEntry>;

function parseInputs() {
	const token = core.getInput("token", { required: true });
	const prereleaseChannel = core.getInput("prerelease-channel") || "";
	const targetBranch = core.getInput("target-branch") || "";

	return { token, prereleaseChannel, targetBranch };
}

/**
 * Resolve the target branch. If not provided, fetch the default branch
 * from the GitHub API.
 */
async function resolveTargetBranch(
	token: string,
	targetBranch: string,
): Promise<string> {
	if (targetBranch) return targetBranch;

	const octokit = getOctokit(token);
	const { data } = await octokit.rest.repos.get({
		owner: context.repo.owner,
		repo: context.repo.repo,
	});
	return data.default_branch;
}

/**
 * Run release-please: create GitHub releases for merged PRs, then
 * create/update release PRs for pending changes.
 *
 * Returns the list of created releases (may be empty).
 */
async function runReleasePlease(manifest: Manifest): Promise<CreatedRelease[]> {
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
}

/**
 * Extract stable versions from created releases.
 */
function extractStableVersions(releases: CreatedRelease[]): VersionsMap {
	const versions: VersionsMap = {};
	for (const release of releases) {
		const path = release.path || ".";
		const version = release.version;
		versions[path] = { version, tag: version, type: "release" };
	}
	return versions;
}

interface PrereleaseOptions {
	token: string;
	manifest: Manifest;
	resolvedBranch: string;
	channel: string;
	existingVersions: VersionsMap;
}

/**
 * Compute prerelease versions by diffing the release-please PR branch
 * manifest against the current manifest. Uses the already-loaded Manifest
 * for strategy-based component resolution and tag construction.
 */
async function computePrereleaseVersions(
	options: PrereleaseOptions,
): Promise<VersionsMap> {
	const { token, manifest, resolvedBranch, channel, existingVersions } =
		options;
	const { owner, repo } = context.repo;
	const versions = { ...existingVersions };

	// Access strategies for component resolution.
	// getStrategiesByPath() is TS-private but accessible at JS runtime.
	const strategiesByPath: Record<string, Strategy> = await (
		manifest as unknown as Record<
			string,
			() => Promise<Record<string, Strategy>>
		>
	).getStrategiesByPath();

	// Determine the release-please PR branch.
	const prBranch = `release-please--branches--${resolvedBranch}`;
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

	// Read current manifest from disk.
	const currentManifest: Record<string, string> = JSON.parse(
		readFileSync(".release-please-manifest.json", "utf-8"),
	);

	core.startGroup("Manifest comparison");
	core.info(`Current: ${JSON.stringify(currentManifest, null, 2)}`);
	core.info(`PR: ${JSON.stringify(prManifest, null, 2)}`);
	core.endGroup();

	// Diff manifests to find changed packages.
	const changedPackages: Record<string, { current: string; next: string }> = {};
	for (const [path, nextVersion] of Object.entries(prManifest)) {
		if (currentManifest[path] !== nextVersion) {
			changedPackages[path] = {
				current: currentManifest[path],
				next: nextVersion,
			};
		}
	}

	core.startGroup("Changed packages");
	core.info(JSON.stringify(changedPackages, null, 2));
	core.endGroup();

	const shortSha = execSync("git rev-parse --short HEAD", {
		encoding: "utf-8",
	}).trim();

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

		// Get component via strategy — handles normalization per release-type
		// (e.g., Node strips @scope/ from package names).
		const component = await strategy.getComponent();

		// Get tag config from repositoryConfig (public, properly merged).
		const config = manifest.repositoryConfig[path];
		const tagSeparator = config.tagSeparator ?? "-";
		const includeVInTag = config.includeVInTag ?? true;

		// Construct last release tag using release-please's TagName.
		const lastVersion = Version.parse(currentVersion);
		const lastTag = new TagName(
			lastVersion,
			component || undefined,
			tagSeparator,
			includeVInTag,
		);
		const lastTagStr = lastTag.toString();

		// Count commits since the last release tag.
		let commitCount: number;
		try {
			execSync(`git rev-parse "${lastTagStr}"`, {
				encoding: "utf-8",
				stdio: "pipe",
			});
			commitCount = parseInt(
				execSync(`git rev-list --count "${lastTagStr}..HEAD"`, {
					encoding: "utf-8",
					stdio: "pipe",
				}).trim(),
				10,
			);
		} catch {
			commitCount = parseInt(
				execSync("git rev-list --count HEAD", {
					encoding: "utf-8",
					stdio: "pipe",
				}).trim(),
				10,
			);
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
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async function () {
	const { token, prereleaseChannel, targetBranch } = parseInputs();

	const { owner, repo } = context.repo;
	core.info(`Repository: ${owner}/${repo}`);
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
