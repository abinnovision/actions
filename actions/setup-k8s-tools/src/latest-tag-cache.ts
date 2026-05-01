import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import type { OctokitType } from "./tools.js";

const CACHE_KEY_PREFIX = "setup-k8s-tools-latest";

interface ResolveLatestTagInput {
	cacheId: string;
	owner: string;
	repo: string;
	tagFilter?: (tag: string) => boolean;
}

const resolveLatestTagFresh = async (
	octokit: OctokitType,
	input: Pick<ResolveLatestTagInput, "owner" | "repo" | "tagFilter">,
): Promise<string> => {
	const { data } = await octokit.rest.repos.listReleases({
		owner: input.owner,
		repo: input.repo,
		per_page: 50,
	});

	const release = data.find((r) => input.tagFilter?.(r.tag_name) ?? true);
	if (release) {
		return release.tag_name;
	}

	throw new Error(`Could not find a release for ${input.owner}/${input.repo}`);
};

// UTC date bucket → cache rotates at most once per day.
const computeBucket = (): string => new Date().toISOString().slice(0, 10);

const buildCacheFilePath = (cacheId: string): string =>
	path.join(
		process.env["RUNNER_TEMP"] ?? os.tmpdir(),
		"setup-k8s-tools",
		"latest",
		`${cacheId}.json`,
	);

const resolveLatestTagCached = async (
	octokit: OctokitType,
	input: ResolveLatestTagInput,
): Promise<string> => {
	const bucket = computeBucket();
	const primaryKey = `${CACHE_KEY_PREFIX}-${input.cacheId}-${bucket}`;
	const restorePrefix = `${CACHE_KEY_PREFIX}-${input.cacheId}-`;
	const filePath = buildCacheFilePath(input.cacheId);

	await fs.mkdir(path.dirname(filePath), { recursive: true });

	const restoredKey = await cache.restoreCache([filePath], primaryKey, [
		restorePrefix,
	]);

	if (restoredKey === primaryKey) {
		try {
			const raw = await fs.readFile(filePath, "utf8");
			const { tag } = JSON.parse(raw) as { tag: string };
			core.info(`${input.cacheId} latest tag restored from cache: ${tag}`);
			return tag;
		} catch (err) {
			core.warning(
				`Failed to read cached latest tag for ${input.cacheId}: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		}
	}

	const tag = await resolveLatestTagFresh(octokit, input);
	core.info(`${input.cacheId} latest tag resolved fresh: ${tag}`);

	try {
		await fs.writeFile(
			filePath,
			JSON.stringify({ tag, resolvedAt: new Date().toISOString() }),
		);
		await cache.saveCache([filePath], primaryKey);
	} catch (err) {
		core.warning(
			err instanceof Error
				? `Failed to save latest-tag cache for ${input.cacheId}: ${err.message}`
				: `Failed to save latest-tag cache for ${input.cacheId}`,
		);
	}

	return tag;
};

export { resolveLatestTagCached };
export type { ResolveLatestTagInput };
