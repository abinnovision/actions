#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import Handlebars from "handlebars";
import tablemark from "tablemark";

// Type definitions
interface InputConfig {
	description?: string;
	required?: boolean;
	default?: string;
	type?: string;
}

interface OutputConfig {
	description?: string;
	value?: string;
}

interface SecretConfig {
	description?: string;
	required?: boolean;
}

interface WorkflowCallConfig {
	inputs?: Record<string, InputConfig>;
	outputs?: Record<string, OutputConfig>;
	secrets?: Record<string, SecretConfig>;
}

interface ActionMetadata {
	name?: string;
	description?: string;
	inputs?: Record<string, InputConfig>;
	outputs?: Record<string, OutputConfig>;
}

interface WorkflowMetadata {
	name?: string;
	description?: string;
	on?: {
		workflow_call?: WorkflowCallConfig;
	};
}

interface VersionInfo {
	full: string;
	major: string;
	minor: string;
}

interface ActionTemplateContext {
	type: "action";
	name: string;
	version: VersionInfo;
	description: string;
	inputs: Record<string, InputConfig>;
	outputs: Record<string, OutputConfig>;
}

interface WorkflowTemplateContext {
	type: "workflow";
	name: string;
	version: VersionInfo;
	description: string;
	inputs: Record<string, InputConfig>;
	outputs: Record<string, OutputConfig>;
	secrets: Record<string, SecretConfig>;
}

type TemplateContext = ActionTemplateContext | WorkflowTemplateContext;

type UsageExampleContext = Pick<
	TemplateContext,
	"type" | "name" | "inputs" | "version"
> &
	Pick<WorkflowTemplateContext, "secrets">;

type VersionExamplesContext = Pick<
	TemplateContext,
	"type" | "name" | "version"
>;

/**
 * Builds the base ref for an action or workflow.
 *
 * @param opts Options for building the base ref, based on the type of template.
 */
const buildItemRef = (
	opts: Pick<TemplateContext, "type" | "name"> & { version?: string },
) => {
	const base =
		opts.type === "workflow"
			? `abinnovision/actions/.github/workflows/workflow.yaml@${opts.name}`
			: `abinnovision/actions@${opts.name}`;

	return opts.version ? `${base}-v${opts.version}` : base;
};

// Register Handlebars helpers
Handlebars.registerHelper(
	"usage-example",
	(context: { hash: UsageExampleContext }) => {
		const { type, name, inputs, secrets, version } = context.hash;

		const ref = buildItemRef({ type, name, version: version.major });

		let example =
			type === "workflow"
				? `jobs:\n  ${name}:\n    uses: ${ref}`
				: `jobs:\n  <job>:\n    steps:\n      - uses: ${ref}`;

		// Add secrets for workflows
		if (type === "workflow" && secrets) {
			const yamlSecrets = secrets || {};
			const requiredSecrets = Object.entries(yamlSecrets).filter(
				([, config]) => (typeof config === "object" ? config.required : false),
			);

			if (requiredSecrets.length > 0) {
				example += "\n    secrets:";
				requiredSecrets.forEach(([secretName]) => {
					example += `\n      ${secretName}: \${{ secrets.${secretName} }}`;
				});
				example += "\n    # Or to inherit the secrets from the caller:";
				example += "\n    secrets: inherit";
			}
		}

		// Add sample inputs if they exist and are required
		const requiredInputs = Object.entries(inputs ?? {}).filter(
			([, config]) => config.required,
		);

		if (requiredInputs.length > 0) {
			const indent = type === "workflow" ? "    " : "        ";
			example += `\n${indent}with:`;
			requiredInputs.forEach(([inputName, config]) => {
				const defaultValue = config.default || `\${{ <${inputName}> }}`;
				example += `\n${indent}  ${inputName}: ${defaultValue}`;
			});
		}

		// Wrap with release-please tags
		const output = `[//]: # "x-release-please-start-major"\n\`\`\`yaml\n${example}\n\`\`\`\n[//]: # "x-release-please-end"`;

		return new Handlebars.SafeString(output);
	},
);

Handlebars.registerHelper(
	"version-examples",
	(context: { hash: VersionExamplesContext }) => {
		const { type, version } = context.hash;

		// Helper to build versioned ref
		const forVersion = (v: string) =>
			`\`${buildItemRef({ ...context.hash, version: v })}\``;

		const text = `This ${type} can be used with different version ranges. The following ranges are available:

- ${forVersion(version.major)}: Targeting major version <!-- x-release-please-major -->
- ${forVersion(version.minor)}: Targeting minor version <!-- x-release-please-minor -->
- ${forVersion(version.full)}: Targeting a patch version <!-- x-release-please-version -->`;

		return new Handlebars.SafeString(text);
	},
);

// Register Handlebars partials
Handlebars.registerPartial(
	"inputs-table",
	(inputs: Record<string, InputConfig>) => {
		if (!inputs || Object.keys(inputs).length === 0) {
			return "";
		}

		const rows = Object.entries(inputs).map(([name, config]) => {
			if (typeof config !== "object") {
				config = {};
			}

			return {
				Input: `\`${name}\``,
				Description: (config.description ?? "").replace(/\n/g, " "),
				Required: config.required ? "Yes" : "No",
				Default: config.default
					? `\`${config.default}\``
					: config.required
						? ""
						: "_empty_",
			};
		});

		return tablemark(rows);
	},
);

Handlebars.registerPartial(
	"outputs-table",
	(outputs: Record<string, OutputConfig>) => {
		if (!outputs || Object.keys(outputs).length === 0) {
			return "";
		}

		const rows = Object.entries(outputs).map(([name, config]) => {
			if (typeof config !== "object") {
				config = {};
			}

			return {
				Output: `\`${name}\``,
				Description: (config.description ?? "").replace(/\n/g, " "),
			};
		});

		return tablemark(rows);
	},
);

Handlebars.registerPartial(
	"secrets-table",
	(secrets: Record<string, SecretConfig>) => {
		if (!secrets || Object.keys(secrets).length === 0) {
			return "";
		}

		const rows = Object.entries(secrets).map(([name, config]) => {
			if (typeof config !== "object") {
				config = {};
			}

			return {
				Secret: `\`${name}\``,
				Description: (config.description ?? "").replace(/\n/g, " "),
				Required: config.required ? "Yes" : "No",
			};
		});

		return tablemark(rows);
	},
);

/**
 * Get version information from package.json or return default
 */
function getVersion(basePath: string): VersionInfo {
	const packageJsonPath = path.join(basePath, "package.json");
	const defaultVersion = "1.0.0";

	let version = defaultVersion;
	if (fs.existsSync(packageJsonPath)) {
		const packageJson = JSON.parse(
			fs.readFileSync(packageJsonPath, "utf8"),
		) as { version?: string };
		version = packageJson.version || defaultVersion;
	}

	const parts = version.split(".");
	const major = parts[0] || "1";
	const minor = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : "1.0";

	return {
		full: version,
		major,
		minor,
	};
}

/**
 * Extract template context for an action
 */
function extractActionContext(
	basePath: string,
	name: string,
): ActionTemplateContext {
	const yamlFile = path.join(basePath, "action.yml");
	const yamlContent = fs.readFileSync(yamlFile, "utf8");
	const yamlData = yaml.load(yamlContent) as ActionMetadata;

	return {
		type: "action",
		name,
		version: getVersion(basePath),
		description: yamlData.description || "",
		inputs: yamlData.inputs || {},
		outputs: yamlData.outputs || {},
	};
}

/**
 * Extract template context for a workflow
 */
function extractWorkflowContext(
	basePath: string,
	name: string,
): WorkflowTemplateContext {
	const yamlFile = path.join(basePath, "workflow.yaml");
	const yamlContent = fs.readFileSync(yamlFile, "utf8");
	const yamlData = yaml.load(yamlContent) as WorkflowMetadata;

	return {
		type: "workflow",
		name,
		version: getVersion(basePath),
		description: yamlData.description || "",
		inputs: yamlData.on?.workflow_call?.inputs || {},
		outputs: yamlData.on?.workflow_call?.outputs || {},
		secrets: yamlData.on?.workflow_call?.secrets || {},
	};
}

/**
 * Generate README from a template file path
 */
function generateReadme(templatePath: string): boolean {
	try {
		// Parse path to determine type and name
		// Expected format: actions/<name>/README.md.hbs or workflows/<name>/README.md.hbs
		const parts = templatePath.split(path.sep);
		const type = parts[0] === "actions" ? "action" : "workflow";
		const name = parts[1];
		const basePath = path.join(parts[0], parts[1]);

		// Extract context based on type
		const context: TemplateContext =
			type === "action"
				? extractActionContext(basePath, name)
				: extractWorkflowContext(basePath, name);

		// Read and compile template
		const template = Handlebars.compile(fs.readFileSync(templatePath, "utf8"));

		// Generate and write README
		fs.writeFileSync(
			path.join(basePath, "README.md"),
			template(context),
			"utf8",
		);

		console.log(`[SUCCESS] Generated README for ${type} '${name}'`);
		return true;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(
			`[ERROR] Failed to generate README from ${templatePath}: ${errorMessage}`,
		);

		return false;
	}
}

/**
 * Find all the README templates in the repository.
 */
const findAllReadmeTemplates = (): string[] =>
	fs
		.globSync("{actions,workflows}/*/README.md.hbs")
		.map((path) => [path, fs.statSync(path)] as const)
		.filter(([, stat]) => stat.isFile())
		.map(([path]) => path);

// Main execution
const readmeTemplates = findAllReadmeTemplates();

console.log(`Found ${readmeTemplates.length} template(s)\n`);

// Generate READMEs and collect success status
const allSuccessful = readmeTemplates.map(generateReadme).every(Boolean);

// Exit with non-zero exit code if any README generation failed
if (!allSuccessful) {
	process.exit(1);
}
