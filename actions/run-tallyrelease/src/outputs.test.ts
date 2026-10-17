import { describe, expect, it } from "vitest";

import { parseGithubOutput } from "./outputs.js";

describe("parseGithubOutput", () => {
	it("returns nothing for an empty file", () => {
		expect(parseGithubOutput("").size).toBe(0);
	});

	it("reads key=value lines and keeps '=' inside the value", () => {
		const outputs = parseGithubOutput(
			'all=true\nreleases=[{"a":"b=c"}]\nbase=\n',
		);
		expect(Object.fromEntries(outputs)).toEqual({
			all: "true",
			releases: '[{"a":"b=c"}]',
			base: "",
		});
	});

	it("reads delimiter blocks with several lines", () => {
		const outputs = parseGithubOutput(
			"affected-paths<<ghadelimiter_1\napps/a\napps/b\nghadelimiter_1\nall=false\n",
		);
		expect(Object.fromEntries(outputs)).toEqual({
			"affected-paths": "apps/a\napps/b",
			all: "false",
		});
	});

	it("reads an empty delimiter block", () => {
		const outputs = parseGithubOutput("paths<<EOF\n\nEOF\n");
		expect(outputs.get("paths")).toBe("");
	});

	it("ignores an unterminated block", () => {
		const outputs = parseGithubOutput("a=1\nb<<EOF\npartial\n");
		expect(Object.fromEntries(outputs)).toEqual({ a: "1" });
	});
});
