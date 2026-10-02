# publish-npm

Publishes the npm packages built by a stack to npmjs and GitHub Packages. It does not check out the repository and does
not install, build or run any script of a package: it writes the released version into each package tarball of the
dist payload, bumps the ranges of dependencies released in the same list and publishes the tarball.

The release list is the `releases` output of a stack, see the
[publishing protocol](../../docs/stacks/README.md#publishing). This workflow consumes `payloads.dist` of the entries
whose `path` matches `include`.

## Behavior

- Skips all work when `releases` is empty, `[]` or no entry matches `include`; other entries are ignored
- Fails when a selected entry has an unsupported `schema` or no `payloads.dist`, before anything is published
- Downloads the dist payload artifact and extracts the tarball of every selected entry
- Writes the entry `version` into the `package.json` of each tarball and bumps dependency ranges of packages released in
  the same list: a range that is exactly `<old>`, `^<old>` or `~<old>`, where `<old>` is that package's version in its
  tarball, becomes `<new>`, `^<new>` or `~<new>`; other ranges are kept as written
- Re-creates the tarball with `tar` from the same files, so no lifecycle script runs
- Publishes with the entry's `channel` as dist-tag, `latest` when it is empty
- Skips packages with `"private": true`, packages no registry applies to (see [Registry selection](#registry-selection))
  and versions that already exist on a registry, so reruns are safe
- A missing tarball, a leftover `workspace:` range (the tarball was not created by `yarn pack`) or a failed publish fails
  that package only: the remaining packages are still published and the job fails at the end
- Writes a job summary with the result per package and registry

## Registry selection

The npm package name and registry selection come from the package's `package.json`:

| Field                     | Default  | Effect                                                                        |
| :------------------------ | :------- | :---------------------------------------------------------------------------- |
| `publishConfig.npm`       | `false`  | Publish to npmjs (also requires the `npm` input)                              |
| `publishConfig.ghpr`      | `false`  | Publish to GitHub Packages (also requires the `ghpr` input and a scoped name) |
| `publishConfig.npmAccess` | `public` | `--access` for npmjs                                                          |

## Authentication

- **npmjs:** [trusted publishing](https://docs.npmjs.com/trusted-publishers) through GitHub OIDC, no token. The trusted
  publisher configured on npmjs must match the calling repository and its workflow file (e.g. `ci.yaml`), not this
  reusable workflow. Verify this for every package before the first release, otherwise the publish fails with an
  authentication error.
- **GitHub Packages:** the workflow `GITHUB_TOKEN`. The package scope must match the repository owner.

The calling job needs these permissions:

```yaml
permissions:
  contents: read
  id-token: write
  packages: write
```

## Usage

This is a `workflow_call` workflow, so it can't be triggered directly. Call it after the stack job that produced the
release list and the dist payload.

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
    # ...stack call with outputs.releases

  publish-npm:
    name: Publish npm
    needs: ci
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-npm-v0
    permissions:
      contents: read
      id-token: write
      packages: write
    with:
      releases: ${{ needs.ci.outputs.releases }}
      npm: true
      ghpr: true
```

[//]: # "x-release-please-end"

## Inputs

| Input        | Description                                                                                                                                                                                                                                                     | Required | Default      |
| :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------- |
| `releases`   | Release list (schema 1) of a stack as a JSON array, the `releases` output of a stack.<br>This workflow publishes the entries matching `include` from their dist payload.<br>An empty string or `[]` skips all work.<br>**Example:** `needs.ci.outputs.releases` | Yes      |              |
| `include`    | Directory patterns of the entries to publish, one per line, matched against the entry `path`.<br>`*` matches one path segment.<br>**Default:** `packages/*`                                                                                                     | No       | `packages/*` |
| `npm`        | Allow publishing to npmjs.<br>Packages opt in through `publishConfig.npm: true` in their `package.json`.<br>**Default:** `false`<br>**Authentication:** OIDC via [npm trusted publishing](https://docs.npmjs.com/trusted-publishers).                           | No       | _empty_      |
| `ghpr`       | Allow publishing to GitHub Packages.<br>Packages opt in through `publishConfig.ghpr: true` in their `package.json` and must be scoped.<br>**Default:** `false`<br>**Authentication:** Uses `GITHUB_TOKEN` (automatically available)                             | No       | _empty_      |
| `provenance` | Generate npm provenance attestations when publishing to npmjs.<br>**Default:** `true`                                                                                                                                                                           | No       | `true`       |
