# publish-npm

Publishes npm package tarballs produced by a stack to npmjs and GitHub Packages. It never checks out
or runs repository code: it downloads the packed tarballs, reads each tarball's own `package.json`
and publishes the tarball as is.

## Behavior

- Skips all work when `releases` is empty or `[]`
- Validates every entry before publishing anything and fails on an unsupported `schema`, a missing
  `name`, `version`, `artifact` or `file`, or entries that do not share one artifact
- Downloads the payload artifact named by the entries (normally `npm-packages`)
- Skips packages with `"private": true`
- Uses the entry's `channel` as dist-tag, `latest` when it is empty
- Skips a registry when that exact version already exists there, so reruns are safe
- A missing tarball, a tarball whose version differs from the entry's `version`, or a failed publish
  fails that package only: it is reported with an error, the remaining packages are still published,
  and the job fails at the end
- Writes a job summary with the result per package and registry

## Release list

`releases` is a JSON array following the
[release list protocol](../../docs/stacks/README.md#release-list) (schema 1), the `npm` output of a
stack:

```json
[
  {
    "schema": 1,
    "name": "client",
    "version": "1.4.0-beta.5",
    "channel": "beta",
    "sha": "a3f2c1d",
    "artifact": "npm-packages",
    "file": "client.tgz"
  }
]
```

The artifact contains one `<name>.tgz` per entry, packed after the version was stamped. The npm
package name and registry selection come from the tarball's `package/package.json`:

| Field                     | Default  | Effect                                                                        |
| :------------------------ | :------- | :---------------------------------------------------------------------------- |
| `publishConfig.npm`       | `false`  | Publish to npmjs (also requires the `npm` input)                              |
| `publishConfig.ghpr`      | `false`  | Publish to GitHub Packages (also requires the `ghpr` input and a scoped name) |
| `publishConfig.npmAccess` | `public` | `--access` for npmjs                                                          |

## Authentication

- **npmjs:** [trusted publishing](https://docs.npmjs.com/trusted-publishers) through GitHub OIDC,
  no token. The trusted publisher configured on npmjs must match the calling repository and its
  workflow file (e.g. `ci.yaml`), not this reusable workflow. Verify this for every package before
  the first release, otherwise the publish fails with an authentication error.
- **GitHub Packages:** the workflow `GITHUB_TOKEN`. The package scope must match the repository owner.

The calling job needs these permissions:

```yaml
permissions:
  contents: read
  id-token: write
  packages: write
```

## Usage

This is a `workflow_call` workflow, so it can't be triggered directly. Call it after the stack job
that produced the release list and artifact.

[//]: # "x-release-please-start-major"

```yaml
jobs:
  publish-npm:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-npm-v0
    with:
      releases: ${{ <releases> }}
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@publish-npm-v0`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@publish-npm-v0.0.0`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

[//]: # "x-release-please-start-major"

```yaml
jobs:
  ci:
    # ...stack call with outputs.npm

  publish-npm:
    name: Publish npm
    needs: ci
    # Publishes the successfully packed units even when the stack partially failed.
    if: ${{ !cancelled() }}
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-npm-v0
    permissions:
      contents: read
      id-token: write
      packages: write
    with:
      releases: ${{ needs.ci.outputs.npm }}
      npm: true
      ghpr: true
```

[//]: # "x-release-please-end"

## Inputs

| Input        | Description                                                                                                                                                                                                                                                                                         | Required | Default |
| :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ |
| `releases`   | Release list (schema 1) as a JSON array, the `npm` output of a stack.<br>Each entry names the tarball (`file`) inside the payload artifact (`artifact`).<br>All entries of one call must share the same artifact.<br>An empty string or `[]` skips all work.<br>**Example:** `needs.ci.outputs.npm` | Yes      |         |
| `npm`        | Allow publishing to npmjs.<br>Packages opt in through `publishConfig.npm: true` in their `package.json`.<br>**Default:** `false`<br>**Authentication:** OIDC via [npm trusted publishing](https://docs.npmjs.com/trusted-publishers).                                                               | No       | _empty_ |
| `ghpr`       | Allow publishing to GitHub Packages.<br>Packages opt in through `publishConfig.ghpr: true` in their `package.json` and must be scoped.<br>**Default:** `false`<br>**Authentication:** Uses `GITHUB_TOKEN` (automatically available)                                                                 | No       | _empty_ |
| `provenance` | Generate npm provenance attestations when publishing to npmjs.<br>**Default:** `true`                                                                                                                                                                                                               | No       | `true`  |
