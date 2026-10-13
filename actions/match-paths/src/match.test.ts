import { describe, expect, it } from "vitest";

import {
	discoverDirectories,
	parseItems,
	parsePatterns,
	resolveItems,
	validateFlag,
	validateTemplate,
} from "./match.js";

import type { Item, ResolveOptions } from "./match.js";

const files = [
	"package.json",
	"apps/web/package.json",
	"apps/api/package.json",
	"apps/api/src/index.ts",
	"apps/.hidden/package.json",
	"apps/nested/deep/package.json",
	"infra/main.tf",
	"infra/prod/main.tofu",
];

interface Case {
	name: string;
	patterns: string;
	candidates?: Item[];
	markers?: string[];
	options?: Partial<ResolveOptions>;
	expected?: Item[];
	error?: string;
}

const cases: Case[] = [
	{
		name: "matches exactly one segment with *",
		patterns: "apps/*",
		expected: [
			{ path: "apps/api", name: "api" },
			{ path: "apps/web", name: "web" },
		],
	},
	{
		name: "treats ** like *",
		patterns: "apps/**",
		expected: [
			{ path: "apps/api", name: "api" },
			{ path: "apps/web", name: "web" },
		],
	},
	{
		name: "names the root after the repository",
		patterns: ".",
		expected: [{ path: ".", name: "repo" }],
	},
	{
		name: "normalizes patterns",
		patterns: "  ./apps/web/  \n\n./",
		expected: [
			{ path: ".", name: "repo" },
			{ path: "apps/web", name: "web" },
		],
	},
	{
		name: "matches nested paths literally",
		patterns: "apps/nested/*",
		expected: [{ path: "apps/nested/deep", name: "deep" }],
	},
	{
		name: "matches nothing without patterns",
		patterns: "",
		expected: [],
	},
	{
		name: "discovers by marker globs",
		patterns: "infra\ninfra/*",
		markers: ["*.tf", "*.tofu"],
		expected: [
			{ path: "infra", name: "infra" },
			{ path: "infra/prod", name: "prod" },
		],
	},
	{
		name: "rejects a leading slash",
		patterns: "/apps/*",
		error: "Invalid pattern '/apps/*'",
	},
	{
		name: "rejects a parent segment",
		patterns: "apps/../*",
		error: "Invalid pattern 'apps/../*'",
	},
	{
		name: "rejects unsupported characters",
		patterns: "apps/{a,b}",
		error: "Invalid pattern 'apps/{a,b}'",
	},
	{
		name: "requires every pattern to match",
		patterns: "apps/*\nlibs/*",
		options: { requireMatch: true },
		error: "Pattern 'libs/*' did not match any path",
	},
	{
		name: "validates discovered names",
		patterns: "*",
		candidates: [{ path: "-bad" }],
		options: { validateNames: true },
		error: "Invalid name '-bad' for path '-bad'",
	},
	{
		name: "flags items and keeps existing names and order",
		patterns: "apps/*",
		candidates: [
			{ path: "libs/x", name: "custom", extra: 1 },
			{ path: "apps/y" },
		],
		options: { flag: "prune" },
		expected: [
			{ path: "libs/x", name: "custom", extra: 1, prune: false },
			{ path: "apps/y", name: "y", prune: true },
		],
	},
	{
		name: "renders templates",
		patterns: ".\napps/*",
		candidates: [{ path: "." }, { path: "apps/web" }],
		options: { template: "state/{path}/{name}" },
		expected: [
			{ path: ".", name: "repo", value: "state/./repo" },
			{ path: "apps/web", name: "web", value: "state/apps/web/web" },
		],
	},
	{
		name: "fails on duplicate values",
		patterns: "apps/*",
		candidates: [{ path: "apps/a" }, { path: "apps/b" }],
		options: { template: "fixed", unique: "value" },
		error: "Duplicate value 'fixed' for paths 'apps/a' and 'apps/b'",
	},
	{
		name: "fails on duplicate names",
		patterns: "*/*",
		candidates: [{ path: "apps/x" }, { path: "libs/x" }],
		options: { unique: "name" },
		error: "Duplicate name 'x' for paths 'apps/x' and 'libs/x'",
	},
];

describe("resolveItems", () => {
	it.each(cases)("$name", (testCase) => {
		const run = () =>
			resolveItems(
				testCase.candidates ??
					discoverDirectories(files, testCase.markers ?? ["package.json"]).map(
						(path) => ({ path }),
					),
				{
					patterns: parsePatterns(testCase.patterns),
					requireMatch: false,
					validateNames: false,
					repository: "org/repo",
					...testCase.options,
				},
			);

		if (testCase.error) {
			expect(run).toThrow(testCase.error);
		} else {
			expect(run()).toEqual(testCase.expected);
		}
	});
});

describe("validateFlag", () => {
	it.each(["path", "name", "value", "content"])("rejects %s", (flag) => {
		expect(() => {
			validateFlag(flag);
		}).toThrow("Input 'flag' must not be one of");
	});
});

describe("validateTemplate", () => {
	it.each([
		["{path}-{name}", undefined],
		["{version}", "Unknown placeholder '{version}' in template"],
		["{path", "Unsupported brace in template '{path'"],
		["{{name}}", "Unsupported brace in template '{{name}}'"],
		["{}", "Unsupported brace in template '{}'"],
		["{a-b}", "Unsupported brace in template '{a-b}'"],
	])("%s", (template, error) => {
		if (error) {
			expect(() => {
				validateTemplate(template);
			}).toThrow(error);
		} else {
			expect(() => {
				validateTemplate(template);
			}).not.toThrow();
		}
	});
});

describe("parseItems", () => {
	it("normalizes item paths", () => {
		expect(parseItems('[{"path": "./apps/x/"}]')).toEqual([{ path: "apps/x" }]);
	});

	it("accepts paths outside the pattern character set", () => {
		expect(parseItems('[{"path": "packages/@scope+x"}]')).toEqual([
			{ path: "packages/@scope+x" },
		]);
	});

	it.each([
		['{"path": "a"}', "Input 'items' must be a JSON array"],
		['[{"name": "a"}]', "Item 0 must be an object with a string 'path'"],
		["[1]", "Item 0 must be an object with a string 'path'"],
		["not json", "Input 'items' is not valid JSON"],
		['[{"path": "../a"}]', "Item 0 has an invalid path '../a'"],
		['[{"path": "/a"}]', "Item 0 has an invalid path '/a'"],
	])("%s", (input, error) => {
		expect(() => parseItems(input)).toThrow(error);
	});
});
