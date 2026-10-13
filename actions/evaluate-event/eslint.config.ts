import { defineConfig } from "eslint/config";
import { base, configFiles } from "@abinnovision/eslint-config-base";

export default defineConfig([
	{ extends: [base] },
	{ files: ["*.{c,m,}{t,j}s"], extends: [configFiles] },
]);
