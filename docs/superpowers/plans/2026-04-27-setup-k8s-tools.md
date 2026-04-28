# setup-k8s-tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `actions/setup-k8s-tools` — a TypeScript GitHub Action that installs kustomize, kubeconform, and kube-score with proper tool caching, replacing `imranismail/setup-kustomize@v3` in the three existing call sites.

**Architecture:** Single composite TypeScript action bundled via `@vercel/ncc`. Each tool is described by a `ToolConfig` object with a single `resolve()` function; all download/cache/PATH logic is shared in `install.ts`. GitHub releases API calls and asset downloads are authenticated via `github-token` input to avoid rate limits.

**Tech Stack:** TypeScript, `@actions/core`, `@actions/tool-cache`, `@actions/github`, `@vercel/ncc`, `@abinnovision/eslint-config-base`, Yarn 4 workspaces, Turbo.

---

## File Map

| Path | Action |
|---|---|
| `actions/setup-k8s-tools/action.yml` | Create — action metadata, inputs, outputs |
| `actions/setup-k8s-tools/package.json` | Create — workspace package, deps, build scripts |
| `actions/setup-k8s-tools/tsconfig.json` | Create — extends root tsconfig.base.json |
| `actions/setup-k8s-tools/eslint.config.ts` | Create — mirrors run-release-please pattern |
| `actions/setup-k8s-tools/.prettierignore` | Create — ignore CHANGELOG.md |
| `actions/setup-k8s-tools/src/tools.ts` | Create — OctokitType, ToolConfig interface, TOOLS array |
| `actions/setup-k8s-tools/src/install.ts` | Create — shared installTool(), platform/arch mapping |
| `actions/setup-k8s-tools/src/main.ts` | Create — entry point, parse inputs, loop over TOOLS |
| `actions/setup-k8s-tools/dist/index.js` | Generated — ncc bundle (committed) |
| `workflows/gitops-deploy/workflow.yaml` | Modify — replace setup-kustomize at lines 320 and 627 |
| `workflows/gitops-update-tags/workflow.yaml` | Modify — replace setup-kustomize at line 176 |

---

### Task 1: Scaffold action package files

**Files:**
- Create: `actions/setup-k8s-tools/action.yml`
- Create: `actions/setup-k8s-tools/package.json`
- Create: `actions/setup-k8s-tools/tsconfig.json`
- Create: `actions/setup-k8s-tools/eslint.config.ts`
- Create: `actions/setup-k8s-tools/.prettierignore`

- [ ] **Step 1: Create `action.yml`**

```yaml
name: Setup Kubernetes Tools
author: "abi group GmbH"
description: |
  Installs kubernetes tooling (kustomize, kubeconform, kube-score) with
  GitHub Actions tool caching. Pass "latest" or a pinned version per tool;
  omit or leave empty to skip a tool.
inputs:
  github-token:
    description: "GitHub token for authenticated API and asset download requests."
    required: true
    default: ${{ github.token }}
  kustomize:
    description: 'Version to install ("latest" or e.g. "v5.4.3"). Empty = skip.'
    required: false
    default: ""
  kubeconform:
    description: 'Version to install ("latest" or e.g. "v0.6.4"). Empty = skip.'
    required: false
    default: ""
  kube-score:
    description: 'Version to install ("latest" or e.g. "v1.18.0"). Empty = skip.'
    required: false
    default: ""
outputs:
  kustomize-version:
    description: "Resolved kustomize version installed (empty if skipped)."
  kubeconform-version:
    description: "Resolved kubeconform version installed (empty if skipped)."
  kube-score-version:
    description: "Resolved kube-score version installed (empty if skipped)."
runs:
  using: node24
  main: dist/index.js
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "setup-k8s-tools",
  "version": "1.0.0",
  "license": "Apache-2.0",
  "author": {
    "name": "abi group GmbH",
    "email": "info@abigroup.io",
    "url": "https://abigroup.io/"
  },
  "type": "module",
  "files": [
    "dist",
    "README.md",
    "CHANGELOG.md",
    "LICENSE.md",
    "action.yml"
  ],
  "scripts": {
    "build": "ncc build src/main.ts",
    "build:watch": "ncc build --watch src/main.ts",
    "format:check": "prettier --check 'src/**/*.{ts,js}' '*.{md,json,json5,yaml,yml}'",
    "format:fix": "prettier --write 'src/**/*.{ts,js}' '*.{md,json,json5,yaml,yml}'",
    "lint:check": "eslint 'src/**/*.{ts,js}'",
    "lint:fix": "eslint --fix 'src/**/*.{ts,js}'"
  },
  "lint-staged": {
    "src/**/*.{ts,js}": [
      "prettier --write",
      "eslint --fix"
    ],
    "*.{md,json,json5,yaml,yml}": [
      "prettier --write"
    ]
  },
  "prettier": "@abinnovision/prettier-config",
  "dependencies": {
    "@actions/core": "^3.0.0",
    "@actions/github": "^9.1.0",
    "@actions/tool-cache": "^2.0.2"
  },
  "devDependencies": {
    "@abinnovision/eslint-config-base": "^3.2.2",
    "@abinnovision/eslint-config-typescript": "^2.2.3",
    "@abinnovision/prettier-config": "^2.1.5",
    "@vercel/ncc": "^0.38.4",
    "eslint": "^9.39.4",
    "prettier": "^3.8.2",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Create `eslint.config.ts`**

```ts
import { defineConfig } from "eslint/config";
import { base, configFiles } from "@abinnovision/eslint-config-base";

export default defineConfig([
  { extends: [base] },
  { files: ["*.{c,m,}{t,j}s"], extends: [configFiles] },
]);
```

- [ ] **Step 5: Create `.prettierignore`**

```
CHANGELOG.md
```

- [ ] **Step 6: Install dependencies from workspace root**

```bash
yarn install
```

Expected: Yarn resolves and links the new workspace package without errors.

---

### Task 2: Implement `src/tools.ts`

**Files:**
- Create: `actions/setup-k8s-tools/src/tools.ts`

- [ ] **Step 1: Create `src/tools.ts`**

```ts
import { getOctokit } from "@actions/github";

export type OctokitType = ReturnType<typeof getOctokit>;

export interface ToolResolution {
  version: string;
  downloadUrl: string;
}

export interface ToolConfig {
  name: string;
  archiveType: "tar" | "zip";
  resolve: (
    input: string,
    octokit: OctokitType,
    platform: string,
    arch: string,
  ) => Promise<ToolResolution>;
}

const resolveLatestTag = async (
  octokit: OctokitType,
  owner: string,
  repo: string,
): Promise<string> => {
  const { data } = await octokit.rest.repos.getLatestRelease({ owner, repo });
  return data.tag_name;
};

export const TOOLS: ToolConfig[] = [
  {
    name: "kustomize",
    archiveType: "tar",
    async resolve(input, octokit, platform, arch) {
      const tag =
        input === "latest"
          ? await resolveLatestTag(octokit, "kubernetes-sigs", "kustomize")
          : `kustomize/${input}`;
      const version = tag.replace("kustomize/", "");
      return {
        version,
        downloadUrl: `https://github.com/kubernetes-sigs/kustomize/releases/download/${encodeURIComponent(tag)}/kustomize_${version}_${platform}_${arch}.tar.gz`,
      };
    },
  },
  {
    name: "kubeconform",
    archiveType: "tar",
    async resolve(input, octokit, platform, arch) {
      const tag =
        input === "latest"
          ? await resolveLatestTag(octokit, "yannh", "kubeconform")
          : input;
      return {
        version: tag,
        downloadUrl: `https://github.com/yannh/kubeconform/releases/download/${tag}/kubeconform-${platform}-${arch}.tar.gz`,
      };
    },
  },
  {
    name: "kube-score",
    archiveType: "tar",
    async resolve(input, octokit, platform, arch) {
      const tag =
        input === "latest"
          ? await resolveLatestTag(octokit, "zegl", "kube-score")
          : input;
      const version = tag.replace(/^v/, "");
      return {
        version: tag,
        downloadUrl: `https://github.com/zegl/kube-score/releases/download/${tag}/kube-score_${version}_${platform}_${arch}.tar.gz`,
      };
    },
  },
];
```

---

### Task 3: Implement `src/install.ts`

**Files:**
- Create: `actions/setup-k8s-tools/src/install.ts`

- [ ] **Step 1: Create `src/install.ts`**

```ts
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

import type { OctokitType, ToolConfig } from "./tools.js";

const mapPlatform = (platform: string): string => {
  const map: Record<string, string> = {
    linux: "linux",
    darwin: "darwin",
    win32: "windows",
  };
  return map[platform] ?? platform;
};

const mapArch = (arch: string): string => {
  const map: Record<string, string> = {
    x64: "amd64",
    arm64: "arm64",
  };
  return map[arch] ?? arch;
};

export const installTool = async (
  config: ToolConfig,
  input: string,
  octokit: OctokitType,
  token: string,
): Promise<void> => {
  if (!input) {
    core.setOutput(`${config.name}-version`, "");
    return;
  }

  const platform = mapPlatform(process.platform);
  const arch = mapArch(process.arch);

  const { version, downloadUrl } = await config.resolve(
    input,
    octokit,
    platform,
    arch,
  );

  const cachedPath = tc.find(config.name, version);
  if (cachedPath) {
    core.info(`${config.name} ${version} restored from cache`);
    core.addPath(cachedPath);
    core.setOutput(`${config.name}-version`, version);
    return;
  }

  core.info(`Downloading ${config.name} ${version}`);
  const downloaded = await tc.downloadTool(downloadUrl, undefined, `Bearer ${token}`);

  const extractedPath =
    config.archiveType === "tar"
      ? await tc.extractTar(downloaded)
      : await tc.extractZip(downloaded);

  const cachedDir = await tc.cacheDir(extractedPath, config.name, version);
  core.addPath(cachedDir);
  core.setOutput(`${config.name}-version`, version);
  core.info(`${config.name} ${version} installed`);
};
```

---

### Task 4: Implement `src/main.ts`

**Files:**
- Create: `actions/setup-k8s-tools/src/main.ts`

- [ ] **Step 1: Create `src/main.ts`**

```ts
import * as core from "@actions/core";
import { getOctokit } from "@actions/github";

import { installTool } from "./install.js";
import { TOOLS } from "./tools.js";

(async () => {
  const token = core.getInput("github-token", { required: true });
  const octokit = getOctokit(token);

  for (const tool of TOOLS) {
    await installTool(tool, core.getInput(tool.name), octokit, token);
  }
})().catch((error: unknown) => {
  core.error(error instanceof Error ? error : String(error));
  core.setFailed("Error while setting up k8s tools");
});
```

---

### Task 5: Build and verify

**Files:**
- Generated: `actions/setup-k8s-tools/dist/index.js`

- [ ] **Step 1: Run TypeScript type-check**

```bash
cd actions/setup-k8s-tools && yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run lint**

```bash
cd actions/setup-k8s-tools && yarn lint:check
```

Expected: no errors.

- [ ] **Step 3: Build the action bundle**

```bash
cd actions/setup-k8s-tools && yarn build
```

Expected: `dist/index.js` created with no errors.

- [ ] **Step 4: Verify binary exists in bundle**

```bash
ls -lh actions/setup-k8s-tools/dist/index.js
```

Expected: file exists, size > 0.

- [ ] **Step 5: Commit the new action**

```bash
git add actions/setup-k8s-tools/
git commit -m "feat: add setup-k8s-tools action with tool caching"
```

---

### Task 6: Update call sites

**Files:**
- Modify: `workflows/gitops-deploy/workflow.yaml`
- Modify: `workflows/gitops-update-tags/workflow.yaml`

- [ ] **Step 1: Update `workflows/gitops-deploy/workflow.yaml` — first usage (validate job, ~line 319)**

Replace:
```yaml
      - name: Setup kustomize
        uses: imranismail/setup-kustomize@v3
```

With:
```yaml
      - name: Setup k8s tools
        uses: abinnovision/actions@setup-k8s-tools-dev
        with:
          kustomize: latest
```

- [ ] **Step 2: Update `workflows/gitops-deploy/workflow.yaml` — second usage (deploy job, ~line 626)**

Replace:
```yaml
      - name: Setup kustomize
        uses: imranismail/setup-kustomize@v3
```

With:
```yaml
      - name: Setup k8s tools
        uses: abinnovision/actions@setup-k8s-tools-dev
        with:
          kustomize: latest
```

- [ ] **Step 3: Update `workflows/gitops-update-tags/workflow.yaml` (~line 175)**

Replace:
```yaml
      - name: Setup kustomize
        uses: imranismail/setup-kustomize@v3
```

With:
```yaml
      - name: Setup k8s tools
        uses: abinnovision/actions@setup-k8s-tools-dev
        with:
          kustomize: latest
```

- [ ] **Step 4: Commit workflow changes**

```bash
git add workflows/gitops-deploy/workflow.yaml workflows/gitops-update-tags/workflow.yaml
git commit -m "feat: replace setup-kustomize with setup-k8s-tools"
```
