import * as core from "@actions/core";
import { getExecOutput } from "@actions/exec";
import path from "node:path";
import picomatch from "picomatch";

import {
	discoverDirectories,
	parseItems,
	parseLines,
	parsePatterns,
	resolveItems,
	validateFlag,
	validateTemplate,
} from "./match.js";

import type { Item } from "./match.js";

/**
 * Runs git silently and returns its stdout, failing on a non-zero exit.
 */
async function git(args: string[]): Promise<string> {
	const { exitCode, stdout, stderr } = await getExecOutput("git", args, {
		silent: true,
		ignoreReturnCode: true,
	});
	if (exitCode !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`);
	}
	return stdout;
}

/**
 * Reads the trimmed first line of each file at HEAD. Files are read one at a time, as each
 * missing blob of a partial clone is fetched on demand.
 */
async function readMarkers(files: string[]): Promise<string[]> {
	const lines: string[] = [];
	for (const file of files) {
		// eslint-disable-next-line no-await-in-loop -- sequential on purpose, see above
		const line = (await git(["cat-file", "blob", `HEAD:${file}`]))
			.split("\n")[0]
			.trim();
		if (line === "") {
			throw new Error(`Marker file '${file}' is empty`);
		}
		lines.push(line);
	}
	return lines;
}

(async () => {
	const itemsInput = core.getInput("items");
	const markers = parseLines(core.getInput("marker"));
	const readMarkerContent = core.getBooleanInput("read-marker");
	const flag = core.getInput("flag");
	const template = core.getInput("template");
	const unique = core.getInput("unique");

	if ((itemsInput === "") === (markers.length === 0)) {
		throw new Error("Exactly one of 'items' or 'marker' must be set");
	}
	if (flag && itemsInput === "") {
		throw new Error("Input 'flag' requires 'items'");
	}
	if (
		readMarkerContent &&
		(markers.length !== 1 || picomatch.scan(markers[0]).isGlob)
	) {
		throw new Error("Input 'read-marker' requires a single literal 'marker'");
	}
	if (markers.some((marker) => marker.includes("/"))) {
		throw new Error("Input 'marker' must only contain file names");
	}
	if (unique !== "" && unique !== "name" && unique !== "value") {
		throw new Error("Input 'unique' must be empty, 'name' or 'value'");
	}
	if (unique === "value" && template === "") {
		throw new Error("Input 'unique: value' requires 'template'");
	}
	if (flag) {
		validateFlag(flag);
	}
	if (template !== "") {
		validateTemplate(template);
	}

	const patterns = parsePatterns(core.getInput("patterns"));

	let candidates: Item[];
	if (markers.length > 0) {
		const files = (await git(["ls-tree", "-r", "--name-only", "-z", "HEAD"]))
			.split("\0")
			.filter((file) => file !== "");
		candidates = discoverDirectories(files, markers).map((dir) => ({
			path: dir,
		}));
	} else {
		candidates = parseItems(itemsInput);
	}

	const items = resolveItems(candidates, {
		patterns,
		requireMatch: core.getBooleanInput("require-match"),
		flag: flag || undefined,
		validateNames: markers.length > 0,
		repository: process.env.GITHUB_REPOSITORY ?? "",
		template: template || undefined,
		unique: unique || undefined,
	});

	if (readMarkerContent) {
		const contents = await readMarkers(
			items.map((item) => path.posix.join(item.path, markers[0])),
		);
		items.forEach((item, index) => {
			item.content = contents[index];
		});
	}

	const paths = items.map((item) => item.path);
	core.info(`Matched ${String(paths.length)} path(s)`);
	for (const item of items) {
		core.info(
			`  ${item.path}${flag ? ` (${flag}: ${String(item[flag])})` : ""}`,
		);
	}

	core.setOutput("items", JSON.stringify(items));
	core.setOutput("paths", JSON.stringify(paths));
	if (template !== "") {
		core.setOutput(
			"values",
			JSON.stringify(
				Object.fromEntries(items.map((item) => [item.path, item.value])),
			),
		);
	}
})().catch((error: unknown) => {
	core.setFailed(error instanceof Error ? error.message : String(error));
});
