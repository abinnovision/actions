# publish-linear

Syncs stable releases of a stack to [Linear Releases](https://linear.app/docs/releases). Each Linear release collects
the issues referenced by the commits since the previous release of its pipeline, through
[linear-release-action](https://github.com/linear/linear-release-action).

The release list is the `releases` output of a stack, see the
[publishing protocol](../../docs/stacks/README.md#publishing). This workflow uses no payload.

## Behavior

- Skips all work when `releases` is empty, `[]` or no stable entry matches a `LINEAR_ACCESS_KEYS` line
- Ignores prereleases (entries with a non-empty `channel`)
- Ignores maintenance releases (`line: maintenance`) unless `maintenance: true`; entries without `line` are synced
- Keeps only the highest version per `path` among entries with `releaseSha` (lists from tallyrelease, which can hold
  several releases of a unit); entries without `releaseSha` are used as listed
- Assigns each entry the first `LINEAR_ACCESS_KEYS` line whose pattern matches its `path`
- Syncs all entries with the same access key as one Linear release with the entry `version`; they must share the
  version, which [linked versions](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#linked-versions)
  guarantee
- Fails before syncing when a key line is malformed, an entry has an unsupported `schema` or a group has differing
  versions
- Links the GitHub release of every entry that has a `url`, plus the workflow run
- Scans up to the `releaseSha` shared by all entries of a group, so a catch-up release does not collect later commits;
  otherwise up to the commit of the run, with a warning when the entries have different release commits
- Re-running a synced list is expected to end green: at the release commit of an existing version the scan range is
  empty and the Linear CLI skips the sync (not yet verified against Linear)

## Pipelines

An access key belongs to one Linear release pipeline. Create a continuous pipeline per product, then map units to its
key:

```
# Apps released together with linked versions: one pipeline.
apps/*,lin_api_abc123

# One pipeline per app.
apps/backend,lin_api_abc123
apps/web,lin_api_def456
```

With one pipeline per unit, set `scope-paths: true` so each release only scans the commits of its unit. Leave it `false`
when a pipeline covers the whole repository: commits in shared packages or at the root also ship with the apps.

## Issue detection

The Linear CLI finds issue identifiers in branch names, commit messages and pull requests. A squash merge commit such
as `feat: add login (#42)` resolves to the issues Linear has linked to pull request #42. A Linear release only lists
issues when pull requests are linked: put the identifier into the branch name, the title or the body (`Fixes ABI-123`).

The first sync of a pipeline only scans the released commit. Later syncs scan from the commit of the previous release.

## Usage

This is a `workflow_call` workflow, so it can't be triggered directly. Call it after the stack job that produced the
release list.

[//]: # "x-release-please-start-major"

```yaml
jobs:
  publish-linear:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-linear-v1
    secrets:
      LINEAR_ACCESS_KEYS: ${{ secrets.LINEAR_ACCESS_KEYS }}
    # Or to inherit the secrets from the caller:
    secrets: inherit
    with:
      releases: ${{ <releases> }}
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@publish-linear-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@publish-linear-v1.0.0`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

[//]: # "x-release-please-start-major"

```yaml
jobs:
  ci:
    # ...stack call with outputs.releases

  publish-linear:
    name: Publish Linear
    needs: ci
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-linear-v1
    permissions:
      contents: read
    secrets:
      LINEAR_ACCESS_KEYS: |
        apps/*,${{ secrets.LINEAR_ACCESS_KEY }}
    with:
      releases: ${{ needs.ci.outputs.releases }}
```

[//]: # "x-release-please-end"

## Inputs

| Input         | Description                                                                                                                                                                                                                                                     | Required | Default |
| :------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ |
| `releases`    | Release list (schema 1) of a stack as a JSON array, the `releases` output of a stack.<br>Stable entries (empty `channel`) are synced to Linear; prereleases are ignored.<br>An empty string or `[]` skips all work.<br>**Example:** `needs.ci.outputs.releases` | Yes      |         |
| `scope-paths` | Only scan commits that touch the paths of the released entries (`<path>/**`), for repositories with one<br>pipeline per unit. When `false`, all commits are scanned, unless the pipeline in Linear has a path filter.<br>**Default:** `false`                   | No       | _empty_ |
| `maintenance` | Also sync entries of maintenance lines (`line: maintenance`). Entries without `line` are always synced.<br>**Default:** `false`                                                                                                                                 | No       | _empty_ |
| `dry-run`     | Scan commits and log the changes without creating or updating releases in Linear.<br>**Default:** `false`                                                                                                                                                       | No       | _empty_ |

## Secrets

| Secret               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Required |
| :------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `LINEAR_ACCESS_KEYS` | Linear release pipeline access keys in **CSV format** (one per line).<br>**Format:** `pattern,access-key`<br>`pattern` is a directory pattern matched against the entry `path`: `*` matches one path segment and skips dot<br>directories, `.` is the repository root. An entry uses the first matching line; entries without a match are<br>skipped. Entries whose lines hold the same key are synced as one Linear release and must share the version.<br>**Example:**<br>`<br>apps/*,lin_api_abc123<br>` | Yes      |
