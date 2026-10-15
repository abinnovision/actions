import pkg from "../package.json";

/** Global flags that take a separate value. */
const GLOBAL_VALUE_FLAGS = new Set(["--cwd", "--config", "--token"]);

/** Commands that write their JSON document with `--out`. */
const OUT_COMMANDS = new Set(["affected", "plan", "shadow"]);

/**
 * The command: the first argument that is neither a flag nor the value of a global flag.
 */
export function command(args: string[]): string | undefined {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (GLOBAL_VALUE_FLAGS.has(arg)) {
			i++;
		} else if (!arg.startsWith("-")) {
			return arg;
		}
	}
	return undefined;
}

/**
 * The bundled `@tallyrelease/cli` version. The dependency is pinned exactly, so the pin is the version.
 */
export const cliVersion = pkg.dependencies["@tallyrelease/cli"];

/**
 * Splits the `args` input. With a newline, every non-empty trimmed line is one argument;
 * otherwise the input is split on whitespace.
 */
export function parseArgs(input: string): string[] {
	return input.includes("\n")
		? input
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean)
		: input.split(/\s+/).filter(Boolean);
}

/**
 * Appends `--pin <version>` to a `shadow` command without an explicit `--pin`.
 */
export function withPin(args: string[], version: string): string[] {
	const hasPin = args.some(
		(arg) => arg === "--pin" || arg.startsWith("--pin="),
	);
	return command(args) === "shadow" && !hasPin
		? [...args, "--pin", version]
		: args;
}

/**
 * Appends `--out <dir>/tallyrelease-<command>.json` to a command that supports `--out` and has none.
 * Returns the arguments and the path of the JSON document, `undefined` when the command writes none.
 */
export function withOut(
	args: string[],
	dir: string,
): { args: string[]; out: string | undefined } {
	const cmd = command(args);
	if (cmd === undefined || !OUT_COMMANDS.has(cmd)) {
		return { args, out: undefined };
	}
	const index = args.findIndex(
		(arg) => arg === "--out" || arg.startsWith("--out="),
	);
	if (index === -1) {
		const out = `${dir}/tallyrelease-${cmd}.json`;
		return { args: [...args, "--out", out], out };
	}
	const arg = args[index];
	return {
		args,
		out: arg === "--out" ? args[index + 1] : arg.slice("--out=".length),
	};
}
