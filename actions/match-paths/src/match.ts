import path from "node:path";
import picomatch from "picomatch";

const PATTERN_REGEX = /^[A-Za-z0-9._/*-]+$/;
const NAME_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PLACEHOLDER_REGEX = /\{(\w+)\}/g;
const PLACEHOLDERS = ["path", "name"];
const RESERVED_FLAGS = ["path", "name", "value", "content"];

/**
 * Compiles a glob where "*" matches one segment and skips dot entries.
 */
function compile(pattern: string): (value: string) => boolean {
	return picomatch(pattern, { noglobstar: true });
}

export interface Item {
	path: string;
	name?: string;
	[key: string]: unknown;
}

export interface ResolveOptions {
	patterns: string[];
	requireMatch: boolean;
	flag?: string;
	validateNames: boolean;
	repository: string;
	template?: string;
	unique?: "name" | "value";
}

/**
 * Splits a multiline input into trimmed, non-empty lines.
 */
export function parseLines(input: string): string[] {
	return input
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "");
}

/**
 * Normalizes a relative path: strips a leading `./` and a trailing `/`. Rejects absolute paths
 * and `..` segments.
 */
export function normalizePath(value: string): string {
	if (
		value === "" ||
		value.startsWith("/") ||
		value.split("/").includes("..")
	) {
		throw new Error(`Invalid path '${value}'`);
	}

	const normalized = path.posix.normalize(value);
	return normalized.length > 1 ? normalized.replace(/\/$/, "") : normalized;
}

/**
 * Validates a directory pattern and normalizes it, e.g. "./apps/x/" to "apps/x".
 */
export function normalizePattern(pattern: string): string {
	if (!PATTERN_REGEX.test(pattern)) {
		throw new Error(`Invalid pattern '${pattern}'`);
	}

	try {
		return normalizePath(pattern);
	} catch {
		throw new Error(`Invalid pattern '${pattern}'`);
	}
}

/**
 * Parses and normalizes multiline directory patterns.
 */
export function parsePatterns(input: string): string[] {
	return parseLines(input).map(normalizePattern);
}

/**
 * Parses the items input, which must be a JSON array of objects with a string path.
 */
export function parseItems(input: string): Item[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(input);
	} catch {
		throw new Error("Input 'items' is not valid JSON");
	}

	if (!Array.isArray(parsed)) {
		throw new Error("Input 'items' must be a JSON array");
	}

	return parsed.map((item: unknown, index) => {
		if (
			typeof item !== "object" ||
			item === null ||
			Array.isArray(item) ||
			typeof (item as Item).path !== "string"
		) {
			throw new Error(
				`Item ${String(index)} must be an object with a string 'path'`,
			);
		}

		let itemPath: string;
		try {
			itemPath = normalizePath((item as Item).path);
		} catch {
			throw new Error(
				`Item ${String(index)} has an invalid path '${(item as Item).path}'`,
			);
		}

		const name = (item as Item).name;
		if (name !== undefined && typeof name !== "string") {
			throw new Error(`Item ${String(index)} has a non-string 'name'`);
		}

		return { ...(item as Item), path: itemPath };
	});
}

/**
 * Returns the sorted, unique directories that directly contain a file whose
 * basename matches one of the marker globs. A root file yields ".".
 */
export function discoverDirectories(
	files: string[],
	markers: string[],
): string[] {
	const matchers = markers.map(compile);
	const directories = new Set<string>();

	for (const file of files) {
		const basename = path.posix.basename(file);
		if (matchers.some((matches) => matches(basename))) {
			directories.add(path.posix.dirname(file));
		}
	}

	return [...directories].sort();
}

/**
 * Derives the item name: the last path segment, or the repository name for ".".
 */
export function deriveName(itemPath: string, repository: string): string {
	if (itemPath === ".") {
		const name = repository.split("/").pop();
		if (!name) {
			throw new Error("Cannot name the root directory without a repository");
		}
		return name;
	}

	return path.posix.basename(itemPath);
}

/**
 * Validates that a flag name does not collide with a built-in item field.
 */
export function validateFlag(flag: string): void {
	if (RESERVED_FLAGS.includes(flag)) {
		throw new Error(
			`Input 'flag' must not be one of ${RESERVED_FLAGS.join(", ")}`,
		);
	}
}

/**
 * Validates that a template only uses known placeholders and has no stray braces.
 */
export function validateTemplate(template: string): void {
	for (const [, key] of template.matchAll(PLACEHOLDER_REGEX)) {
		if (!PLACEHOLDERS.includes(key)) {
			throw new Error(`Unknown placeholder '{${key}}' in template`);
		}
	}

	if (/[{}]/.test(template.replace(PLACEHOLDER_REGEX, ""))) {
		throw new Error(`Unsupported brace in template '${template}'`);
	}
}

/**
 * Renders a validated template for an item in a single pass.
 */
export function renderTemplate(template: string, item: Item): string {
	return template.replace(PLACEHOLDER_REGEX, (_, key: string) =>
		String(item[key]),
	);
}

/**
 * Filters or flags candidates by the patterns, then adds names and template values.
 */
export function resolveItems(
	candidates: Item[],
	options: ResolveOptions,
): Item[] {
	const matchers = options.patterns.map(compile);

	if (options.requireMatch) {
		options.patterns.forEach((pattern, index) => {
			if (!candidates.some((item) => matchers[index](item.path))) {
				throw new Error(`Pattern '${pattern}' did not match any path`);
			}
		});
	}

	const flag = options.flag;
	const selected = flag
		? candidates.map((item) => ({
				...item,
				[flag]: matchers.some((matches) => matches(item.path)),
			}))
		: candidates.filter((item) =>
				matchers.some((matches) => matches(item.path)),
			);

	const items = selected.map((item) => {
		const name = item.name ?? deriveName(item.path, options.repository);
		if (options.validateNames && !NAME_REGEX.test(name)) {
			throw new Error(
				`Invalid name '${name}' for path '${item.path}', expected ${NAME_REGEX.source}`,
			);
		}

		const named: Item = { ...item, name };
		if (options.template !== undefined) {
			named.value = renderTemplate(options.template, named);
		}

		return named;
	});

	if (options.unique) {
		const seen = new Map<unknown, string>();
		for (const item of items) {
			const key = item[options.unique];
			const previous = seen.get(key);
			if (previous !== undefined) {
				throw new Error(
					`Duplicate ${options.unique} '${String(key)}' for paths '${previous}' and '${item.path}'`,
				);
			}
			seen.set(key, item.path);
		}
	}

	return items;
}
