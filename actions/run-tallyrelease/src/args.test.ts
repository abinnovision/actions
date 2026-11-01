import { describe, expect, it } from "vitest";

import { cliVersion, command, parseArgs, withOut } from "./args.js";

describe("parseArgs", () => {
	it("splits a single line on whitespace", () => {
		expect(parseArgs("  affected   --github-output ")).toEqual([
			"affected",
			"--github-output",
		]);
	});

	it("takes one argument per line and keeps spaces inside a line", () => {
		expect(parseArgs("plan\n--out\n  /tmp/my plan.json  \n")).toEqual([
			"plan",
			"--out",
			"/tmp/my plan.json",
		]);
	});

	it("ignores blank lines", () => {
		expect(parseArgs("\nplan\n\n  \n--all\n")).toEqual(["plan", "--all"]);
	});
});

describe("command", () => {
	it("finds the first argument that is not a flag or a global flag value", () => {
		expect(command(["plan", "--all"])).toBe("plan");
		expect(command(["--cwd", "shadow", "--verbose", "affected"])).toBe(
			"affected",
		);
		expect(command(["--config=x.yaml", "explain", "shadow"])).toBe("explain");
		expect(command(["--verbose"])).toBeUndefined();
	});
});

describe("withOut", () => {
	it("appends --out for affected, plan and run", () => {
		expect(withOut(["plan", "--all"], "/tmp")).toEqual({
			args: ["plan", "--all", "--out", "/tmp/tallyrelease-plan.json"],
			out: "/tmp/tallyrelease-plan.json",
		});
		expect(withOut(["affected"], "/tmp").out).toBe(
			"/tmp/tallyrelease-affected.json",
		);
		expect(withOut(["run", "--dry-run"], "/tmp")).toEqual({
			args: ["run", "--dry-run", "--out", "/tmp/tallyrelease-run.json"],
			out: "/tmp/tallyrelease-run.json",
		});
	});

	it("keeps an explicit --out", () => {
		expect(withOut(["plan", "--out", "p.json"], "/tmp")).toEqual({
			args: ["plan", "--out", "p.json"],
			out: "p.json",
		});
		expect(withOut(["affected", "--out=r.json"], "/tmp")).toEqual({
			args: ["affected", "--out=r.json"],
			out: "r.json",
		});
		expect(withOut(["run", "--dry-run", "--out", "r.json"], "/tmp")).toEqual({
			args: ["run", "--dry-run", "--out", "r.json"],
			out: "r.json",
		});
	});

	it("leaves commands without --out unchanged", () => {
		for (const args of [["check"], ["graph"], ["explain", "cli"]]) {
			expect(withOut(args, "/tmp")).toEqual({ args, out: undefined });
		}
	});
});

describe("cliVersion", () => {
	it("is an exact version", () => {
		expect(cliVersion).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
	});
});
