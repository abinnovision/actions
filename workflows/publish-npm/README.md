# publish-npm

Publishes the npm packages built by a stack to npmjs and GitHub Packages. It does not check out the repository and does
not install, build or run any script of a package: it writes the released version into each package tarball of the
dist payload, bumps the ranges of dependencies released in the same list and publishes the tarball.

The release list is the `releases` output of a stack (release list v2), see the
[publishing protocol](../../docs/stacks/README.md#publishing). This workflow publishes the entries whose `tags` contain
`dist`.

## Behavior

- Skips all work when `releases` is empty, `[]` or no entry is tagged `dist`; other entries are ignored
- Fails when any entry has no `latest` (not a release list v2 entry), before anything is selected or published
- Reads the tarball `<id>.tgz` of each entry from the artifact `payload-dist`, or `payload-dist-<releaseSha>` for a
  `catchUp` entry
- Downloads every distinct payload artifact of the selected entries, fails before publishing when one is missing, and
  extracts the tarball of every selected entry
- Writes the entry `version` into the `package.json` of each tarball and bumps dependency ranges of packages released in
  the same list from the same artifact: a range that is exactly `<old>`, `^<old>` or `~<old>`, where `<old>` is that
  package's version in its tarball, becomes `<new>`, `^<new>` or `~<new>`; other ranges are kept as written
- Re-creates the tarball with `tar` from the same files, so no lifecycle script runs
- Publishes the entries in list order and sets the dist-tag as described in [Dist-tags](#dist-tags)
- Skips packages with `"private": true`, packages no registry applies to (see [Registry selection](#registry-selection))
  and versions that already exist on a registry, so reruns are safe
- A missing tarball, a leftover `workspace:` range (the tarball was not created by `yarn pack`) or a failed publish fails
  that package only: the remaining packages are still published and the job fails at the end
- Writes a job summary with the result per package and registry

## Dist-tags

| Entry                      | Dist-tag      |
| :------------------------- | :------------ |
| `kind: prerelease`         | The `channel` |
| Stable with `latest: true` | `latest`      |
| Stable otherwise           | `backport`    |

`latest` is the highest stable version of the unit and is never set on a maintenance line. The re-run guard keeps a
re-run from moving `latest`: when the run attempt is greater than 1 and the tip of the run's branch is no longer the
commit of the run, or cannot be read, every stable entry is published as `backport` with a warning.

A version that already exists is skipped and its dist-tags are left as they are. The first publish of a package always
sets `latest` on the registry, also with `--tag backport`.

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
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-npm-v1
    with:
      releases: ${{ <releases> }}
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@publish-npm-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@publish-npm-v1.1.0`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

[//]: # "x-release-please-start-major"

```yaml
jobs:
  ci:
    # ...stack call with outputs.releases

  publish-npm:
    name: Publish npm
    needs: ci
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-npm-v1
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

## Migrating from v1

- `releases` must be a release list v2 (app-stack v2); a v1 list fails on the entry check
- `include` is removed: entries are selected by the `dist` tag of the unit in the tallyrelease config
- The dist-tag of a stable entry comes from its `latest`; the repository tags are no longer read

## Inputs

| Input        | Description                                                                                                                                                                                                                                        | Required | Default |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ |
| `releases`   | Release list v2 of a stack as a JSON array, the `releases` output of a stack.<br>This workflow publishes the entries tagged `dist` from their dist payload.<br>An empty string or `[]` skips all work.<br>**Example:** `needs.ci.outputs.releases` | Yes      |         |
| `npm`        | Allow publishing to npmjs.<br>Packages opt in through `publishConfig.npm: true` in their `package.json`.<br>**Default:** `false`<br>**Authentication:** OIDC via [npm trusted publishing](https://docs.npmjs.com/trusted-publishers).              | No       | _empty_ |
| `ghpr`       | Allow publishing to GitHub Packages.<br>Packages opt in through `publishConfig.ghpr: true` in their `package.json` and must be scoped.<br>**Default:** `false`<br>**Authentication:** Uses `GITHUB_TOKEN` (automatically available)                | No       | _empty_ |
| `provenance` | Generate npm provenance attestations when publishing to npmjs.<br>**Default:** `true`                                                                                                                                                              | No       | `true`  |
