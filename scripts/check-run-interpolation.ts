#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";

import { load as loadYaml } from "js-yaml";

import { findYamlFilesToCheck } from "./lib/yaml-files.js";

interface Step {
	id?: string;
	name?: string;
	run?: unknown;
}

interface YamlDocument {
	jobs?: Record<string, { steps?: Step[] } | null>;
	runs?: { steps?: Step[] };
}

/**
 * Returns the steps of a document, labelled by their job id (or 'runs' for composite actions).
 */
function collectSteps(doc: YamlDocument): [string, Step[]][] {
	const groups: [string, Step[]][] = [];

	for (const [jobId, job] of Object.entries(doc.jobs ?? {})) {
		if (Array.isArray(job?.steps)) groups.push([jobId, job.steps]);
	}

	if (Array.isArray(doc.runs?.steps)) groups.push(["runs", doc.runs.steps]);

	return groups;
}

// Files that are exempt until they are migrated or removed.
const EXEMPT_FILES = new Set([
	"actions/setup-node/action.yml",
	"actions/setup-tools/action.yml",
	"workflows/polyglot-monorepo-stack/workflow.yaml",
]);

function main() {
	const rootDir = process.cwd();
	const files = findYamlFilesToCheck(rootDir).filter(
		(filePath) => !EXEMPT_FILES.has(path.relative(rootDir, filePath)),
	);
	const errors: string[] = [];

	for (const filePath of files) {
		const relative = path.relative(rootDir, filePath);
		const doc = loadYaml(fs.readFileSync(filePath, "utf8")) as YamlDocument;

		for (const [group, steps] of collectSteps(doc)) {
			steps.forEach((step, index) => {
				if (typeof step.run === "string" && step.run.includes("${{")) {
					const label = step.name ?? step.id ?? `#${index + 1}`;
					errors.push(
						`${relative}: ${group} / ${label}: expression inside run`,
					);
				}
			});
		}
	}

	if (errors.length > 0) {
		console.error("Run interpolation check failed:\n");
		for (const error of errors) {
			console.error(`  ${error}`);
		}
		console.error(
			"\nPass values to 'run' steps through 'env' instead of '${{ }}' expressions.",
		);
		process.exit(1);
	}

	console.log(`Checked ${files.length} files, no expressions inside 'run'.`);
}

main();
