# publish-linear

Syncs stable releases of a stack to [Linear Releases](https://linear.app/docs/releases). Each Linear release lists
the issues linked to the pull requests of the release, as computed by tallyrelease, through the
`releaseSyncByAccessKey` mutation of the Linear API.

The release list is the `releases` output of a stack released with tallyrelease, see the
[publishing protocol](../../docs/stacks/README.md#publishing). This workflow uses no payload and no checkout.

## Behavior

- Skips all work when `releases` is empty, `[]` or no stable entry has a `LINEAR_ACCESS_KEYS` line
- Ignores prereleases (entries with a non-empty `channel`)
- Ignores maintenance releases (`line: maintenance`) unless `maintenance: true`
- Keeps only the highest version per `path` when a list holds several releases of a unit (catch-ups), with the `prs`
  of all of them
- Assigns each entry the `LINEAR_ACCESS_KEYS` line of its tallyrelease unit `id`; entries without a line are skipped
- Syncs all entries with the same access key as one Linear release named `v<version>`; they must share the version,
  which a tallyrelease group guarantees
- Fails before syncing when a key line is malformed, a unit has several lines, an entry has an unsupported `schema` or
  no `id` or `prs`, or a group has differing versions
- Sends the union of the `prs` of a group; Linear adds the issues linked to these pull requests
- Links the GitHub release of every entry, plus the workflow run
- Attaches the bodies of these GitHub releases as the Linear release notes, with a heading per entry when a group has
  several; a release that cannot be read is skipped with a warning
- Syncs at the `releaseSha` of the group, the newest one with a warning when the entries have different release
  commits. Re-running a synced list is expected to update the same Linear release, which a continuous pipeline
  identifies by commit (not yet verified against Linear)

## Pipelines

An access key belongs to one Linear release pipeline. Create a continuous pipeline per product, then map its
tallyrelease units to its key, one line per unit:

```
# backend and web released together in a tallyrelease group: one pipeline.
backend,lin_api_abc123
web,lin_api_abc123

# One pipeline per unit.
sdk,lin_api_def456
```

## Issue detection

`prs` holds the pull requests of the commits tallyrelease attributed to the release, including those of the units it
was propagated from, so a release caused only by a dependency lists the issues of that dependency. Linear resolves
each pull request to the issues it has linked: put the identifier into the branch name, the title or the body
(`Fixes ABI-123`). Commits pushed without a pull request contribute no issues.

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
    permissions:
      contents: read
    secrets:
      LINEAR_ACCESS_KEYS: |
        backend,${{ secrets.LINEAR_ACCESS_KEY }}
    with:
      releases: ${{ needs.ci.outputs.releases }}
```

[//]: # "x-release-please-end"

## Inputs

| Input         | Description                                                                                                                                                                                                                                                                                                                   | Required | Default |
| :------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ |
| `releases`    | Release list (schema 1) of a stack as a JSON array, the `releases` output of a stack released with<br>tallyrelease. Stable entries (empty `channel`) are synced to Linear; prereleases are ignored. Every synced<br>entry needs `prs`.<br>An empty string or `[]` skips all work.<br>**Example:** `needs.ci.outputs.releases` | Yes      |         |
| `maintenance` | Also sync entries of maintenance lines (`line: maintenance`). Entries without `line` are always synced.<br>**Default:** `false`                                                                                                                                                                                               | No       | _empty_ |

## Secrets

| Secret               | Description                                                                                                                                                                                                                                                                                                                                                                                                                 | Required |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `LINEAR_ACCESS_KEYS` | Linear release pipeline access keys in **CSV format** (one per line).<br>**Format:** `unit,access-key`<br>`unit` is a tallyrelease unit id, matched against the entry `id`; each unit may appear once. Entries without a<br>line are skipped. Units whose lines hold the same key are synced as one Linear release and must share the<br>version.<br>**Example:**<br>`<br>backend,lin_api_abc123<br>web,lin_api_abc123<br>` | Yes      |
