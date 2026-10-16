import { describe, expect, it } from "vitest";

import { cliVersion, command, parseArgs, withOut, withPin } from "./args.js";

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

describe("withPin", () => {
	it("appends --pin to shadow", () => {
		expect(withPin(["shadow", "--summary"], "1.2.3")).toEqual([
			"shadow",
			"--summary",
			"--pin",
			"1.2.3",
		]);
	});

	it("keeps an explicit --pin", () => {
		expect(withPin(["shadow", "--pin", "x"], "1.2.3")).toEqual([
			"shadow",
			"--pin",
			"x",
		]);
		expect(withPin(["shadow", "--pin=x"], "1.2.3")).toEqual([
			"shadow",
			"--pin=x",
		]);
	});

	it("skips global flags and their values", () => {
		expect(withPin(["--cwd", "shadow", "shadow"], "1.2.3")).toEqual([
			"--cwd",
			"shadow",
			"shadow",
			"--pin",
			"1.2.3",
		]);
		expect(
			withPin(["--config=x.yaml", "--verbose", "shadow"], "1.2.3"),
		).toEqual(["--config=x.yaml", "--verbose", "shadow", "--pin", "1.2.3"]);
	});

	it("leaves other commands unchanged", () => {
		expect(withPin(["plan", "--all"], "1.2.3")).toEqual(["plan", "--all"]);
		expect(withPin(["explain", "shadow"], "1.2.3")).toEqual([
			"explain",
			"shadow",
		]);
		expect(withPin(["plan", "--branch", "shadow"], "1.2.3")).toEqual([
			"plan",
			"--branch",
			"shadow",
		]);
		expect(withPin(["--cwd", "shadow", "plan"], "1.2.3")).toEqual([
			"--cwd",
			"shadow",
			"plan",
		]);
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
	it("appends --out for affected, plan, shadow and run", () => {
		expect(withOut(["plan", "--all"], "/tmp")).toEqual({
			args: ["plan", "--all", "--out", "/tmp/tallyrelease-plan.json"],
			out: "/tmp/tallyrelease-plan.json",
		});
		expect(withOut(["affected"], "/tmp").out).toBe(
			"/tmp/tallyrelease-affected.json",
		);
		expect(withOut(["shadow"], "/tmp").out).toBe(
			"/tmp/tallyrelease-shadow.json",
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
		expect(withOut(["shadow", "--out=r.json"], "/tmp")).toEqual({
			args: ["shadow", "--out=r.json"],
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
