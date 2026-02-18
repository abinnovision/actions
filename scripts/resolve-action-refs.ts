#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";

interface PackageJson {
	name: string;
	version: string;
	actionDependencies?: Record<string, string>;
}

interface ResolvedDep {
	name: string;
	version: string;
}

function parseArgs(): { stagingDir: string; workspaceRoot: string } {
	const args = process.argv.slice(2);
	let stagingDir = "";
	let workspaceRoot = "";

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--staging-dir" && args[i + 1]) {
			stagingDir = args[++i];
		} else if (args[i] === "--workspace-root" && args[i + 1]) {
			workspaceRoot = args[++i];
		}
	}

	if (!stagingDir || !workspaceRoot) {
		console.error(
			"Usage: resolve-action-refs.ts --staging-dir <path> --workspace-root <path>",
		);
		process.exit(1);
	}

	return { stagingDir, workspaceRoot };
}

function findPackageInWorkspace(
	workspaceRoot: string,
	depName: string,
): PackageJson {
	const candidates = [
		path.join(workspaceRoot, "actions", depName, "package.json"),
		path.join(workspaceRoot, "workflows", depName, "package.json"),
	];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return JSON.parse(fs.readFileSync(candidate, "utf8")) as PackageJson;
		}
	}

	console.error(
		`Error: actionDependency '${depName}' not found in workspace. Checked actions/${depName}/ and workflows/${depName}/`,
	);
	process.exit(1);
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findYamlFiles(dir: string): string[] {
	const results: string[] = [];

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...findYamlFiles(fullPath));
		} else if (/\.ya?ml$/.test(entry.name)) {
			results.push(fullPath);
		}
	}

	return results;
}

/**
 * Discovers all internal package names from the workspace.
 */
function discoverInternalPackages(workspaceRoot: string): Set<string> {
	const names = new Set<string>();

	for (const dir of ["actions", "workflows"]) {
		const base = path.join(workspaceRoot, dir);
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

function main() {
	const { stagingDir, workspaceRoot } = parseArgs();

	// Read package.json from staging dir
	const pkgJsonPath = path.join(stagingDir, "package.json");
	if (!fs.existsSync(pkgJsonPath)) {
		console.error(`Error: No package.json found in staging dir: ${stagingDir}`);
		process.exit(1);
	}

	const pkgJson = JSON.parse(
		fs.readFileSync(pkgJsonPath, "utf8"),
	) as PackageJson;
	const actionDeps = pkgJson.actionDependencies ?? {};

	if (Object.keys(actionDeps).length === 0) {
		console.log(
			`[${pkgJson.name}] No actionDependencies declared, skipping resolution.`,
		);
		return;
	}

	// Resolve each dependency's version from workspace
	const resolvedDeps: ResolvedDep[] = Object.keys(actionDeps).map((name) => {
		const depPkg = findPackageInWorkspace(workspaceRoot, name);
		return { name, version: depPkg.version };
	});

	console.log(
		`[${pkgJson.name}] Resolving ${resolvedDeps.length} action dependency reference(s)...`,
	);

	// Discover all internal package names for undeclared-ref detection
	const internalNames = discoverInternalPackages(workspaceRoot);
	const declaredNames = new Set(Object.keys(actionDeps));

	// Find all YAML files in staging dir
	const yamlFiles = findYamlFiles(stagingDir);

	let totalReplacements = 0;
	const undeclaredRefs: string[] = [];
	const usedDeps = new Set<string>();

	for (const filePath of yamlFiles) {
		let content = fs.readFileSync(filePath, "utf8");
		let modified = false;

		// Replace declared deps: @{name}-dev → @{name}-v{version}
		for (const dep of resolvedDeps) {
			const pattern = new RegExp(
				`(abinnovision/actions(?:/\\.github/workflows/workflow\\.yaml)?)@${escapeRegex(dep.name)}-dev`,
				"g",
			);

			const matches = content.match(pattern);
			if (matches) {
				usedDeps.add(dep.name);
				content = content.replace(
					pattern,
					`$1@${dep.name}-v${dep.version}`,
				);
				totalReplacements += matches.length;
				modified = true;
			}
		}

		// Check for undeclared internal -dev refs
		const undeclaredPattern =
			/abinnovision\/actions(?:\/\.github\/workflows\/workflow\.yaml)?@([a-z0-9-]+)-dev/g;
		let match;
		while ((match = undeclaredPattern.exec(content)) !== null) {
			const refName = match[1];
			if (internalNames.has(refName) && !declaredNames.has(refName)) {
				undeclaredRefs.push(
					`${path.relative(stagingDir, filePath)}: references internal action '${refName}' not declared in actionDependencies`,
				);
			}
		}

		if (modified) {
			fs.writeFileSync(filePath, content, "utf8");
		}
	}

	// Error on undeclared refs
	if (undeclaredRefs.length > 0) {
		console.error(
			"Error: Found references to internal actions not declared in actionDependencies:",
		);
		for (const ref of undeclaredRefs) {
			console.error(`  - ${ref}`);
		}
		process.exit(1);
	}

	// Warn on unused declared deps
	for (const dep of resolvedDeps) {
		if (!usedDeps.has(dep.name)) {
			console.warn(
				`Warning: actionDependency '${dep.name}' is declared but no matching -dev reference found in YAML files`,
			);
		}
	}

	for (const dep of resolvedDeps) {
		if (usedDeps.has(dep.name)) {
			console.log(`  ${dep.name}-dev → ${dep.name}-v${dep.version}`);
		}
	}

	console.log(`[${pkgJson.name}] Resolved ${totalReplacements} reference(s).`);
}

main();
