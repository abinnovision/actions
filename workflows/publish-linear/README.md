# publish-linear

Syncs the releases of a stack to [Linear Releases](https://linear.app/docs/releases). Each Linear release lists the
issues linked to the pull requests tallyrelease attributed to the release, through the `releaseSyncByAccessKey`
mutation of the Linear API.

The release list is the `releases` output of a stack, see the
[publishing protocol](../../docs/stacks/README.md#publishing). This workflow uses no payload and no checkout.

## Behavior

- Skips all work when `releases` is empty, `[]` or no release has a `LINEAR_ACCESS_KEYS` line
- Ignores prereleases (entries of kind `prerelease`)
- Skips runs on branches other than the default branch, i.e. maintenance lines, unless `maintenance: true`; entries
  carry no line, so the branch of the run decides
- Assigns each entry the `LINEAR_ACCESS_KEYS` line of its release item: the fixed `group` of the entry, or its unit
  `id`; entries without a line are skipped
- Syncs one Linear release named `v<version>` per item and version, at the `releaseSha` of its first entry. The
  entries of a fixed group release together and share the commit; a list holding several versions of a unit
  (catch-ups) creates one Linear release per version, oldest first
- Sends the union of the `prs` of the entries; Linear adds the issues linked to these pull requests. `prs` includes
  the pull requests of the units a release was propagated from, so a release caused only by a dependency lists the
  issues of that dependency
- Links the GitHub release of every entry that has one, plus the workflow run
- Fails before syncing when a key line is malformed, an item has several lines or an entry has no `latest` (a release
  list v1)
- Re-running a synced list is expected to update the same Linear release, which a continuous pipeline identifies by
  commit (not yet verified against Linear)

## Pipelines

An access key belongs to one Linear release pipeline. Create a continuous pipeline per product, then map its release
items to its key, one line per item. An item is the name of a fixed tallyrelease group or a unit id. In this example,
backend and web release together in the fixed group `platform` and share one pipeline, while the `sdk` unit has its
own:

```
platform,lin_api_abc123
sdk,lin_api_def456
```

## Issue detection

Linear resolves each pull request to the issues it has linked. A Linear release only lists issues when pull requests
are linked: put the identifier into the branch name, the title or the body (`Fixes ABI-123`). Commits pushed without a
pull request contribute no issues.

## Migrating from v1

- Call it with the release list v2 of app-stack v2; a list v1 fails on the entry check
- Key `LINEAR_ACCESS_KEYS` by release item (`backend,lin_api_abc123`) instead of a directory pattern (`apps/*`)
- Remove `scope-paths` and `dry-run`
- `maintenance` now follows the branch of the run instead of the `line` of the entries

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
- `abinnovision/actions/.github/workflows/workflow.yaml@publish-linear-v1.1.0`: Targeting a patch version <!-- x-release-please-version -->

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
    permissions: {}
    secrets:
      LINEAR_ACCESS_KEYS: |
        backend,${{ secrets.LINEAR_ACCESS_KEY }}
    with:
      releases: ${{ needs.ci.outputs.releases }}
```

[//]: # "x-release-please-end"

## Inputs

| Input         | Description                                                                                                                                                                                                                                      | Required | Default |
| :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ |
| `releases`    | Release list v2 of a stack as a JSON array, the `releases` output of a stack.<br>Entries of kind `release` are synced to Linear; prereleases are ignored.<br>An empty string or `[]` skips all work.<br>**Example:** `needs.ci.outputs.releases` | Yes      |         |
| `maintenance` | Also sync releases of runs on branches other than the default branch, i.e. maintenance lines. Entries carry no<br>line, so the branch of the run decides.<br>**Default:** `false`                                                                | No       | _empty_ |

## Secrets

| Secret               | Description                                                                                                                                                                                                                                                                                                                                                 | Required |
| :------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `LINEAR_ACCESS_KEYS` | Linear release pipeline access keys in **CSV format** (one per line).<br>**Format:** `item,access-key`<br>`item` is a tallyrelease release item: the fixed `group` of an entry, or its unit `id` when the entry has no<br>group. Each item may appear once. Entries whose item has no line are skipped.<br>**Example:**<br>`<br>backend,lin_api_abc123<br>` | Yes      |
