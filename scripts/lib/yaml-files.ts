import fs from "node:fs";
import path from "node:path";

/**
 * Finds all YAML files to check (action.yml, workflow.yaml, .github/workflows/*.yaml).
 */
export function findYamlFilesToCheck(rootDir: string): string[] {
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
