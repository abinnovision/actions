# run-release-please

Runs release-please and computes version information, supporting both
stable releases and prerelease channels. Replaces googleapis/release-please-action
with sane defaults (repo-based configuration via release-please-config.json).

## How it works

This action wraps [release-please](https://github.com/googleapis/release-please) and extends it with prerelease channel support. It replaces both `googleapis/release-please-action@v4` and the companion bash script that was previously needed to compute version metadata.

### Stable releases

On every run, the action calls `createReleases()` (to publish GitHub releases for merged release PRs) and `createPullRequests()` (to create or update release PRs for pending changes). This mirrors what `googleapis/release-please-action` does in manifest mode. Stable versions are extracted directly from the created release objects.

### Prerelease channels

When `prerelease-channel` is set (e.g., `beta`), the action computes prerelease versions for packages that have pending changes but haven't been released yet:

1. Fetches the `.release-please-manifest.json` from the release-please PR branch and compares it against the current manifest on disk.
2. For each package where the version differs (i.e., release-please has bumped it), computes a prerelease version in the format: `{next-version}-{channel}.{commit-count}+{short-sha}` (e.g., `1.4.0-beta.5+a3f2c1d`).
3. Uses release-please's own strategy classes for correct component resolution (e.g., Node strips `@scope/` from package names) and tag construction, avoiding the gaps that a standalone bash script would have.

The `versions` output is a JSON object mapping package paths to version info, where each entry includes a `type` field (`"release"` or `"prerelease"`) so callers can distinguish between the two.

### Differences from `googleapis/release-please-action`

- **Single step** instead of action + bash script for version computation.
- **Built-in prerelease support** with correct component resolution via release-please internals.
- **Simplified output**: a single `versions` JSON object instead of flat key-value pairs (e.g., `path--version`, `releases_created`).
- **No `releases-created` output**: callers check `versions != '{}'` or inspect the `type` field instead.
- **Config-driven**: all release-please configuration comes from `release-please-config.json` in the repository; no action-level config inputs beyond `token`, `prerelease-channel`, and `target-branch`.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@run-release-please-v1
        with:
          token: ${{ <token> }}
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@run-release-please-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@run-release-please-v1.0.1`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                | Description                                                                 | Required | Default |
| :------------------- | :-------------------------------------------------------------------------- | :------- | :------ |
| `token`              | GitHub token for API access (needs contents:write and pull-requests:write). | Yes      |         |
| `prerelease-channel` | Prerelease channel name (e.g., beta, canary, rc).                           | No       | _empty_ |
| `target-branch`      | Branch to release from. Defaults to the repository default branch.          | No       | _empty_ |

## Outputs

| Output     | Description                                                                                                                                                                                                                      |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `versions` | JSON object mapping released package paths to version info.<br>Each entry: {version: "semver+sha", packageVersion: "clean semver", type: "release"\|"prerelease"}.<br>Empty object {} when nothing was released or computed.<br> |
