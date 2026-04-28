# Design: `actions/setup-k8s-tools`

**Date:** 2026-04-27
**Status:** Approved

## Overview

Replace the third-party `imranismail/setup-kustomize@v3` action (used in 3 places) with a first-party TypeScript action that installs kustomize, kubeconform, and kube-score with proper GitHub Actions tool caching. Follows the existing `run-release-please` / `run-commitlint` action pattern: TypeScript source bundled via `@vercel/ncc`.

## Inputs

| Input | Default | Description |
|---|---|---|
| `github-token` | `${{ github.token }}` | Token for authenticated GitHub API and asset download requests |
| `kustomize` | `""` | Version to install (`"latest"` or `"v5.4.3"`), empty = skip |
| `kubeconform` | `""` | Version to install (`"latest"` or `"v0.6.4"`), empty = skip |
| `kube-score` | `""` | Version to install (`"latest"` or `"v1.18.0"`), empty = skip |

## Outputs

| Output | Description |
|---|---|
| `kustomize-version` | Resolved version installed (empty if skipped) |
| `kubeconform-version` | Resolved version installed (empty if skipped) |
| `kube-score-version` | Resolved version installed (empty if skipped) |

## Architecture

### Tool config abstraction

Each tool is a single config object. The only tool-specific code is the `resolve` function:

```ts
interface ToolResolution {
  version: string;      // normalised semver string, used as cache key
  downloadUrl: string;  // direct GitHub release asset URL
}

interface ToolConfig {
  name: string;
  archiveType: "tar" | "zip";
  resolve: (input: string, octokit: Octokit) => Promise<ToolResolution>;
}
```

Adding a new tool requires only a new `ToolConfig` object — no changes to shared infrastructure.

### Shared install flow

`installTool(config, input, octokit, token)`:

1. If `input` is empty, skip — set empty output, return.
2. Call `config.resolve(input, octokit)` → `{ version, downloadUrl }`.
3. `tc.find(config.name, version)` — on cache hit: `core.addPath()`, set output, return.
4. On miss: `tc.downloadTool(downloadUrl, undefined, { authorization: "Bearer " + token })`.
5. Extract: `tc.extractTar()` or `tc.extractZip()` based on `config.archiveType`.
6. `tc.cacheDir(extractedPath, config.name, version)` — stores in tool cache.
7. `core.addPath(cachedPath)`.
8. `core.setOutput(`${config.name}-version`, version)`.

Authentication is applied to both the GitHub API (via Octokit) and the asset download (via Authorization header), preventing rate limit errors on both calls.

### OS/arch detection

`resolve` receives the OS (`linux`, `darwin`, `windows`) and arch (`amd64`, `arm64`) derived from `process.platform` and `process.arch` at runtime, and uses them to construct the correct asset URL. The tool cache key also includes OS/arch so cached binaries are never served to a mismatched runner.

### Tool configs

**kustomize** (`kubernetes-sigs/kustomize`)
- Tags use format `kustomize/vX.Y.Z`; `resolve` strips the `kustomize/` prefix for the version key.
- Asset pattern: `kustomize_vX.Y.Z_{os}_{arch}.tar.gz`.

**kubeconform** (`yannh/kubeconform`)
- Tags use plain `vX.Y.Z`.
- Asset pattern: `kubeconform-{os}-{arch}.tar.gz`.

**kube-score** (`zegl/kube-score`)
- Tags use plain `vX.Y.Z`.
- Asset pattern: `kube-score_X.Y.Z_{os}_{arch}.tar.gz`.

### "latest" resolution

When input is `"latest"`, `resolve` calls `octokit.rest.repos.getLatestRelease()` and extracts `tag_name`. The resolved concrete version is used as the cache key — so the cache is stable within a release and misses automatically when a new version ships.

## File structure

```
actions/setup-k8s-tools/
  action.yml          # uses: node20, main: dist/index.js
  package.json        # @actions/core, @actions/tool-cache, @actions/github; ncc build
  src/
    main.ts           # entry point: parse inputs, loop installTool over configs
    tools.ts          # ToolConfig definitions for kustomize, kubeconform, kube-score
    install.ts        # shared installTool() function
  dist/               # bundled output (committed)
```

## Call site changes

Three existing usages of `imranismail/setup-kustomize@v3` are replaced:

- `workflows/gitops-deploy/workflow.yaml:320`
- `workflows/gitops-deploy/workflow.yaml:627`
- `workflows/gitops-update-tags/workflow.yaml:176`

Each becomes:

```yaml
- name: Setup k8s tools
  uses: abinnovision/actions@setup-k8s-tools-dev
  with:
    kustomize: latest
```

Additional tools (`kubeconform`, `kube-score`) can be added at any call site independently.

## Dependencies

- `@actions/core` — inputs, outputs, addPath
- `@actions/tool-cache` — find, downloadTool, extractTar/extractZip, cacheDir
- `@actions/github` — Octokit for authenticated releases API
- `@vercel/ncc` (dev) — bundle to single `dist/index.js`
