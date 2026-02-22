#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";

interface PackageJson {
	name: string;
	version: string;
	actionDependencies?: Record<string, string>;
}

/**
 * Discovers all internal package names from workspace directories.
 */
function discoverInternalPackages(rootDir: string): Set<string> {
	const names = new Set<string>();

	for (const dir of ["actions", "workflows"]) {
		const base = path.join(rootDir, dir);
		if (!fs.existsSync(base)) continue;

		for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const pkgPath = path.join(base, entry.name, "package.json");
			if (fs.existsSync(pkgPath)) {
				const pkg = JSON.parse(
					fs.readFileSync(pkgPath, "utf8"),
				) as PackageJson;
				names.add(pkg.name);
			}
		}
	}

	return names;
}

/**
 * Finds all YAML files to check (action.yml, workflow.yaml, .github/workflows/*.yaml).
 */
function findYamlFilesToCheck(rootDir: string): string[] {
	const files: string[] = [];

	// actions/*/action.yml
	const actionsDir = path.join(rootDir, "actions");
	if (fs.existsSync(actionsDir)) {
		for (const entry of fs.readdirSync(actionsDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const yamlPath = path.join(actionsDir, entry.name, "action.yml");
			if (fs.existsSync(yamlPath)) files.push(yamlPath);
		}
	}

	// workflows/*/workflow.yaml
	const workflowsDir = path.join(rootDir, "workflows");
	if (fs.existsSync(workflowsDir)) {
		for (const entry of fs.readdirSync(workflowsDir, {
			withFileTypes: true,
		})) {
			if (!entry.isDirectory()) continue;
			const yamlPath = path.join(workflowsDir, entry.name, "workflow.yaml");
			if (fs.existsSync(yamlPath)) files.push(yamlPath);
		}
	}

	// .github/workflows/*.yaml and *.yml
	const ghWorkflowsDir = path.join(rootDir, ".github", "workflows");
	if (fs.existsSync(ghWorkflowsDir)) {
		for (const entry of fs.readdirSync(ghWorkflowsDir, {
			withFileTypes: true,
		})) {
			if (entry.isFile() && /\.ya?ml$/.test(entry.name)) {
				files.push(path.join(ghWorkflowsDir, entry.name));
			}
		}
	}

	return files;
}

/**
 * Reads actionDependencies from a package's package.json, if it belongs to
 * the actions/ or workflows/ directories.
 */
function getActionDependencies(
	rootDir: string,
	filePath: string,
): Record<string, string> | null {
	const relative = path.relative(rootDir, filePath);
	const parts = relative.split(path.sep);

	// Only check files in actions/ or workflows/ (not .github/workflows/)
	if (parts[0] !== "actions" && parts[0] !== "workflows") {
		return null;
	}

	const pkgDir = path.join(rootDir, parts[0], parts[1]);
	const pkgPath = path.join(pkgDir, "package.json");
	if (!fs.existsSync(pkgPath)) return null;

	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as PackageJson;
	return pkg.actionDependencies ?? {};
}

function main() {
	const rootDir = process.cwd();
	const internalNames = discoverInternalPackages(rootDir);
	const files = findYamlFilesToCheck(rootDir);
	const errors: string[] = [];

	// Regex matches both action and workflow reference patterns:
	// abinnovision/actions@{name}-{tag}
	// abinnovision/actions/.github/workflows/workflow.yaml@{name}-{tag}
	const pattern =
		/abinnovision\/actions(?:\/\.github\/workflows\/workflow\.yaml)?@([a-z0-9-]+)-(\S+)/g;

	for (const filePath of files) {
		const content = fs.readFileSync(filePath, "utf8");
		const relative = path.relative(rootDir, filePath);

		// Get actionDependencies if this is a published package
		const actionDeps = getActionDependencies(rootDir, filePath);

		let match;
		// Reset lastIndex since we reuse the regex
		pattern.lastIndex = 0;

		while ((match = pattern.exec(content)) !== null) {
			const name = match[1];
			const tag = match[2];

			// Only validate refs to internal packages
			if (!internalNames.has(name)) continue;

			// Check 1: Tag must be 'dev'
			if (tag !== "dev") {
				errors.push(
					`${relative}: Found pinned reference '@${name}-${tag}' (expected '@${name}-dev')`,
				);
			}

			// Check 2: If this is a published package, the dep must be declared in actionDependencies
			if (actionDeps !== null && tag === "dev") {
				if (!actionDeps[name]) {
					errors.push(
						`${relative}: References internal action '${name}' but it is not declared in actionDependencies`,
					);
				} else {
					// Validate the range format
					const rangePattern = /^(\^|~)?\d+\.\d+\.\d+$/;
					if (!rangePattern.test(actionDeps[name])) {
						errors.push(
							`${relative}: actionDependencies['${name}'] has invalid range '${actionDeps[name]}'. Expected '^X.Y.Z', '~X.Y.Z', or 'X.Y.Z'.`,
						);
					}
				}
			}
		}
	}

	if (errors.length > 0) {
		console.error("Action reference check failed:\n");
		for (const error of errors) {
			console.error(`  ${error}`);
		}
		console.error(
			"\nAll internal action references must use '-dev' tags in source files.",
		);
		console.error(
			"Version pinning happens automatically during publish.",
		);
		console.error(
			"Published packages must declare internal deps in 'actionDependencies' in package.json.",
		);
		process.exit(1);
	}

	console.log(
		`Checked ${files.length} files — all internal references use '-dev' tags.`,
	);
}

main();
