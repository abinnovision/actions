# app-stack

CI for Yarn repositories: Turborepo monorepos that mix Node.js, Python and Go, and
[single-package repositories](#single-package-repositories). It checks, builds and tests the
repository on every pull request. On every branch push it also packs the affected [units](#units)
into two target-neutral payloads and creates [releases](#releases) with tallyrelease. It publishes
nothing itself; the caller wires the [`releases`](#outputs) list into
[`publish-oci`](../publish-oci/README.md), [`publish-npm`](../publish-npm/README.md) and
[`publish-linear`](../publish-linear/README.md), which own the registries and their credentials.

It follows the shared [stack contract](../../docs/stacks/README.md) for calling, naming, jobs and required checks.

## Behavior

| Job             | Runs                                                 | Does                                                                                                                                                |
| :-------------- | :--------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Configure`     | Always                                               | Resolves the commit and mode, validates the Makefile if present, resolves the affected units on push, discovers test types                          |
| `Check`         | Always                                               | Install, dependency checks, `build`, `check` and unit tests; on branch push also prunes the affected source units and packs the affected dist units |
| `Test`          | One job per test type not already covered by `Check` | Install, `build` and `test-<type>`                                                                                                                  |
| `Release`       | Branch push, after `Check` and `Test`                | Runs `tallyrelease run`, which lands and updates release PRs and creates the tags and GitHub releases, then writes the `releases` list              |
| `Release build` | One job per release commit with catch-up payloads    | Builds the payloads of those releases, see [Catch-ups](#catch-ups)                                                                                  |
| `Release plan`  | Pull requests                                        | Runs `tallyrelease plan` for the base branch. Never fails                                                                                           |
| `Status`        | Always                                               | Single required status check, fails when any other job failed or was cancelled                                                                      |

- Unit tests run inside `Check` by default, which avoids a second install and build. Set
  `run-unit-tests-in-build: false` to move them into the `Test` matrix
- `Check` builds before it checks, so linter and formatter config that lives in a compiled workspace
  package is always available

## Requirements

- The repository has a `.tool-versions` file with `nodejs` and a root `package.json` with `build` and `check` scripts,
  see [Repository layout](#repository-layout)
- The repository has a `tallyrelease.yaml` that tags its units, see [Units](#units) and [Releases](#releases)
- The caller grants the [permissions](#permissions) listed below

## Usage

This is a `workflow_call` workflow, so it can't be triggered directly. Call it from a workflow triggered by
`pull_request` and `push` (never `pull_request_target`).

[//]: # "x-release-please-start-major"

```yaml
jobs:
  app-stack:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@app-stack-v1
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@app-stack-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@app-stack-v1.6.0`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

Complete, copyable caller workflow `.github/workflows/ci.yaml`. The publish jobs receive the same
`releases` list and select their entries: `publish-oci` the entries tagged `source`, `publish-npm`
those tagged `dist`, `publish-linear` the stable releases. The list is empty on pull requests and on
pushes that release nothing, and the publish jobs then skip all work.

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions: {}

jobs:
  ci:
    name: CI
    uses: abinnovision/actions/.github/workflows/workflow.yaml@app-stack-v1 # x-release-please-major
    permissions:
      contents: read
      packages: read
      actions: write
      id-token: write

  publish-npm:
    name: Publish npm
    needs: ci
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-npm-v2
    permissions:
      contents: read
      id-token: write
      packages: write
    with:
      releases: ${{ needs.ci.outputs.releases }}
      npm: true
      ghpr: true

  publish-oci:
    name: Publish OCI
    needs: ci
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v2
    permissions:
      contents: read
      id-token: write
      packages: write
      actions: write
    with:
      releases: ${{ needs.ci.outputs.releases }}
      image: app-{id}
      registry: ${{ vars.FOUNDRY_REGISTRY_DOCKER }}
      gcp-workload-identity-provider: ${{ vars.FOUNDRY_WIF_PROVIDER }}
      gitops-routes: |
        backend,prerelease,<gitops-repo>,staging
        backend,release,<gitops-repo>,production

  publish-linear:
    name: Publish Linear
    needs: ci
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-linear-v2
    permissions: {}
    secrets:
      LINEAR_ACCESS_KEYS: ${{ secrets.LINEAR_ACCESS_KEYS }}
    with:
      releases: ${{ needs.ci.outputs.releases }}
```

The resulting check contexts are `CI / Configure`, `CI / Check`, `CI / Test: <type>`,
`CI / Release`, `CI / Status`, on pull requests also `CI / Release plan`, and `CI / Release build: <sha>`
per catch-up commit. Require `CI / Status` and `Lint commits` in your rulesets.

The workflow takes no secrets. To read other private repositories during checkout, use
[`checkout-token-resources`](#checking-out-other-repositories).

## Repository layout

### Makefile

With a Makefile, dependency installation goes through `make`, so each repository can define its own
strategy across languages. Two targets are required; `Configure` fails the run if `install-immutable`
is missing. Without a Makefile the workflow runs `yarn install --immutable`.

| Target              | Purpose                          | Used by           |
| ------------------- | -------------------------------- | ----------------- |
| `install`           | Install dependencies             | Local development |
| `install-immutable` | Install with lockfile validation | CI                |

```makefile
.PHONY: install install-immutable

install:
	yarn install
	uv sync              # only if the repo has Python packages
	go mod download      # only if the repo has Go packages

install-immutable:
	yarn install --immutable
	uv sync --frozen
	go mod download && go mod verify
```

### Directory structure

```
your-repo/
├── Makefile              # optional: install and install-immutable targets
├── .tool-versions        # asdf versions: nodejs (required), python, golang, uv
├── tallyrelease.yaml     # units, their tags and the branch rules
├── packages/             # dist units, tagged `dist`
│   └── <id>/package.json
└── apps/                 # source units, tagged `source`
    └── <id>/
        ├── package.json
        └── Dockerfile    # read by publish-oci, not by this workflow
```

### Root scripts

Your root `package.json` must define:

```json
{
  "scripts": {
    "build": "turbo run build",
    "check": "turbo run lint:check format:check",
    "test-unit": "turbo run test-unit"
  }
}
```

`build` compiles every workspace and `check` runs linting and formatting. Each entry in `test-types`
needs a matching `test-<type>` script, so enabling `test-types: unit,integration` requires both
`test-unit` and `test-integration`.

## Triggers

| Event                        | Runs                                                                               | Actions cache                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `pull_request`               | `Configure`, `Check`, `Test`, `Release plan`                                       | Read/write in the PR scope, restores from the default branch       |
| `merge_group`                | `Configure`, `Check`, `Test`                                                       | Read/write in the queue scope, restores from the default branch    |
| `push` to the default branch | everything, including `Release`                                                    | Read/write in the default branch scope, the cache PRs restore from |
| `push` to another branch     | everything, releasing for that branch, see [Maintenance lines](#maintenance-lines) | Read/write in the branch scope                                     |
| `pull_request_target`        | Nothing, `Configure` fails                                                         |                                                                    |

Releasing and packing are gated inside the workflow on branch pushes, so a pull request can never reach them.

`merge_group` is optional and only fires when a merge queue is enabled on the branch. If you use
one, add it to the trigger block:

```yaml
merge_group:
  types: [checks_requested]
```

### Concurrency

Declare concurrency in the calling workflow. A called workflow sees the caller's `github.workflow`,
so declaring a group on both sides collides and GitHub cancels the run as a deadlock. Use:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}-${{ github.event.pull_request.number || github.event.merge_group.id || 'main' }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' || github.event_name == 'merge_group' }}
```

Pull requests and merge groups supersede themselves; every branch push releases, and none of them is
cancelled while running. GitHub keeps only one pending run per group, though: when several pushes land while a run
is in progress, only the newest one runs afterwards and the ones in between are cancelled before they
start. Their commits are still released by the next run, with payloads built from its commit.

### Permissions

The workflow declares `permissions: {}` and grants each job only what it needs. The `ci` job of the
caller must grant the union:

| Permission        | Used by                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `contents: read`  | Every checkout                                                          |
| `packages: read`  | Private GitHub Package Registry dependencies during install             |
| `actions: write`  | Saving entries to the Actions cache and uploading the payload artifacts |
| `id-token: write` | The checkout and release token exchanges                                |

`Configure` needs nothing beyond this set: its `actions: read` for the base lookup is covered by `actions: write`.
`Release plan` runs on pull requests, whose base is the merge base, and only reads contents. `Release` writes with a token from the token broker, see [Releases](#releases). A called workflow can
never exceed its caller's permissions. The publish jobs declare their own permissions, see
[`publish-npm`](../publish-npm/README.md) and [`publish-oci`](../publish-oci/README.md).

### Forks and Dependabot

Pull requests from forks get a read-only token and no OIDC token: cache saves are skipped, private
submodules and private GitHub Package Registry dependencies do not resolve, and the checkout token
exchange is skipped. Dependabot pull requests keep cache writes. `Check` and `Test` run regardless.

## Units

Units, their ids and their tags come from `tallyrelease.yaml`. The tags `source` and `dist` are
app-stack conventions; a key with `*` is a glob over unit roots, where `*` matches exactly one path
segment and skips dot directories:

```yaml
# tallyrelease.yaml
units:
  "apps/*": { release: true, tags: [source] }
  "packages/*": { release: true, tags: [dist] }
```

| Tag      | On branch push                                                          |
| :------- | :---------------------------------------------------------------------- |
| `source` | `Check` runs `turbo prune --docker` per unit into the source payload    |
| `dist`   | `Check` runs `yarn pack` per unit after its build into the dist payload |

On push `Configure` runs `tallyrelease affected --tag source` and `--tag dist`, so only the units
changed since the last successful run, plus the units depending on them, are pruned and packed.
Every unit is selected when there is no base or a global input changed. A repository without units
of one tag gets the warning `W_TAG_UNKNOWN` for it.

A unit's `id` is its directory basename unless set with `id:`; tallyrelease fails with
`E_DUPLICATE_UNIT` when two units share one. Every source unit needs a `name` in its `package.json`,
and Turbo must be a dependency in the root `package.json`. Packing is not filtered by `private`.
`turbo boundaries` runs in `Check` when Turbo is a dependency.

### Single-package repositories

Globs never match the repository root, so the root unit `.` is listed explicitly. Its `id` is the
repository name, and its dist tarball is `<repository>.tgz`. A root source unit is not pruned; the
source payload already holds the whole tree. Turbo and a Makefile are not needed.

```yaml
# tallyrelease.yaml
units:
  ".": { release: true, tags: [dist] }
```

Use `tags: [source]` instead when the root has a `Dockerfile` for `publish-oci`.

## Publishing

The payloads, the `releases` list and the rules of the publish workflows are described in the
[publish protocol](../../docs/stacks/README.md#publishing). A failing `yarn pack` or prune fails the
run before anything is released. Every entry's payload follows one rule:

| Tag      | Artifact                                                    | File         |
| :------- | :---------------------------------------------------------- | :----------- |
| `source` | `payload-source`, `payload-source-<releaseSha>` on catch-up | `source.tar` |
| `dist`   | `payload-dist`, `payload-dist-<releaseSha>` on catch-up     | `<id>.tgz`   |

## Dockerfiles

`publish-oci` builds each image from the source payload with `<path>/Dockerfile`, using the tar
root as build context. A Dockerfile copies from the pruned `out/<id>/` tree: `json/` and the
lockfile for the dependency layer, `full/` for the sources. A root source unit (`.`) is not pruned,
so its `Dockerfile` copies from the tracked source tree at the tar root. The build arguments, such as
`app_name`, `node_version` and `build_version`, are provided by `publish-oci`, see its
[README](../publish-oci/README.md).

```dockerfile
ARG node_version
ARG python_version

FROM node:${node_version}-alpine AS node-builder
FROM python:${python_version}-slim AS python-builder
```

## Checking out other repositories

By default every checkout uses the job's `GITHUB_TOKEN`, which only reaches the calling repository.
For private submodules, private Go modules or other git-based dependencies, set
`checkout-token-resources`. The workflow then exchanges its OIDC token at the token broker
(`token-broker-url` or the `TOKEN_BROKER_URL` variable) for a short-lived token with `contents:read`
on this repository plus the listed resources and uses it for every checkout. The token broker's
GitHub App must be installed on every listed resource.

```yaml
with:
  checkout-submodules: recursive
  checkout-token-resources: repo:my-org/private-submodule repo:my-org/go-lib
```

Prefer `repo:` over `org:` or `enterprise:`: the token is persisted as a git credential for the
whole job, so every later step, including test code, can read everything it grants. Private GitHub
Package Registry dependencies use the job `GITHUB_TOKEN` and are unaffected.

## Releases

Every branch push releases with [tallyrelease](https://github.com/abinnovision/tallyrelease) through
[run-tallyrelease](../../actions/run-tallyrelease/README.md). `Release` checks out the full history and runs
`tallyrelease run --branch <branch> --base <base> --github-output --summary`, with the build base of `Configure`: it tags
merged release PRs, creates the GitHub releases, updates the release PRs, writes the plan summary and the `releases`
list (artifact `tallyrelease-run`). The token comes from the token broker with
`contents:write pull_requests:write issues:read actions:read`, so the broker's GitHub App needs these permissions on the
repository. Release PR commits are authored by that App (`<app>[bot]`). The caller grants no new permissions.
tallyrelease creates the labels `tallyrelease: pending`, `tallyrelease: released` and `tallyrelease: stale` when they are
missing; creating them up front is recommended.

- Channels come from the branch rules in `tallyrelease.yaml`: a line with `channel` lists its units with pending changes
  as prereleases of that channel
- On pull requests `Release plan` runs `tallyrelease plan --branch <base> --all --summary` (artifact
  `tallyrelease-plan`). It only observes: every step may fail without failing it, and `Status` does not depend on it
- The caller must declare the workflow-level concurrency group shown in [Concurrency](#concurrency). The stack adds no
  job-level concurrency

```yaml
# tallyrelease.yaml
branches:
  - { name: main, line: default, channel: beta }
```

### Catch-ups

When a release run was cancelled by the concurrency group or failed, the next run lists those releases again, with
`catchUp: true` and the release commit as `releaseSha`. A release of a unit outside the build set is a catch-up too.
Every `catchUp: false` entry gets its payloads from `Check`; every release commit with catch-ups gets a
`Release build: <sha>` job that checks it out, prunes, builds and packs the released units into
`payload-source-<releaseSha>` and `payload-dist-<releaseSha>`. Checks and tests do not run there. A failing
`Release build` fails `Status` and the caller's `ci` job, so publish jobs with `needs: ci` are skipped for the whole run;
the next run lists those releases again.

**Re-runs.** "Re-run failed jobs" reuses the release list and payloads of the first attempt; publishers skip what was
published. When a run is stuck on a tallyrelease error (`E_BASE_REQUIRED`, `E_TAG_EXISTS`, `E_PUSH_LEASE`), follow the
[recovery steps](https://github.com/abinnovision/tallyrelease/blob/main/packages/cli/README.md#releases-in-ci) of the CLI.

### Release list

`releases` (v2) is tallyrelease's `releases` output with `changes` replaced by `prs`, `[]` when nothing was released.
Each entry has `id`, `path`, `kind` (`release` or `prerelease`), `version`, `channel`, `tag`, `releaseSha`, `catchUp`,
`forge`, `latest`, `tags` and `group`, see the [CLI README](https://github.com/abinnovision/tallyrelease/blob/main/packages/cli/README.md#releases-in-ci).
`prs` holds the pull request numbers of the release's changes, those of propagated units included. `changes` is dropped
because the list travels through `env:` in every publisher, which caps a variable at 128 KiB. The payloads follow the
rule in [Publishing](#publishing).

### Maintenance lines

Every branch push packs the payloads and runs `tallyrelease run --branch <branch>`, and `Release plan` plans pull
requests for their base branch. Branch rules live in `tallyrelease.yaml`: a branch with `line: maintenance` releases on
its line, `unit:` or `group:` names what the line releases for the absolute version check. A branch without a line rule
releases nothing: tallyrelease warns `W_EFFECT_SKIPPED`, the `releases` list is `[]` and the run stays green.

```yaml
# tallyrelease.yaml
branches:
  - { name: main, line: default }
  - { name: "release/{major}.x", line: maintenance, unit: lib }
```

Add the maintenance patterns to both triggers of the caller:

```yaml
on:
  pull_request:
    branches: [main, "release/**"]
  push:
    branches: [main, "release/**"]
```

- A maintenance release gets a GitHub release that is not marked latest, and its entry has `latest: false`.
  `publish-npm` publishes it with the dist-tag `backport` and `publish-oci` pushes `<version>` without `latest` and does
  not dispatch GitOps, since `latest` is never set on a maintenance line. `publish-linear` skips it unless `maintenance: true`
- Rulesets on `release/**` must allow merging the release PRs, like on the default branch
- Keep `push.branches` limited to the default branch and the maintenance patterns, since every push is a release run

## Migrating from v1

- Delete `release-please-config.json` and `.release-please-manifest.json`, and close open release-please PRs
- Add a `tallyrelease.yaml` and set `tagFormat` so it matches the existing tags
- Move the `source-units` and `dist-units` patterns into `tallyrelease.yaml` as `source` and `dist` tags; list the root
  `.` explicitly
- Add `id:` where two units share a basename, since tallyrelease fails with `E_DUPLICATE_UNIT`
- An `id:` override changes the `out/<id>/` path Dockerfiles copy from and the `<id>.tgz` file name
- Callers whose `push.branches` covers more than the default branch now release on those branches too
- Drop the removed inputs `tallyrelease`, `shadow-issue`, `prerelease-channel`, `source-units`, `dist-units` and
  `build-selection`; prerelease channels move to the branch rules
- Update `publish-oci`, `publish-npm` and `publish-linear` to their v2 together with this workflow: they fail on a v1
  release list, and v1 publishers cannot read a v2 one

## Inputs

| Input                      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Required | Default |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ |
| `token-broker-url`         | URL of the token broker for OIDC token exchange.<br>**Default:** Falls back to `vars.TOKEN_BROKER_URL` if not provided.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | _empty_ |
| `default-branch`           | Default branch name for the repository.<br>**Default:** `main`<br>**Example:** `main`, `master`, `develop`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | No       | `main`  |
| `test-types`               | Comma-separated list of test types to run.<br>**Valid values:** `unit`, `integration`, `e2e`<br>**Default:** `unit`<br>**Example:** `unit,integration,e2e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | No       | `unit`  |
| `run-unit-tests-in-build`  | Run unit tests as part of the check job instead of a separate job.<br>Recommended for smaller monorepos to reduce overall execution time.<br>**Default:** `true`<br>**Note:** You must include `unit` in the `test-types` input for this to have any effect.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | No       | `true`  |
| `checkout-submodules`      | Whether to checkout submodules.<br>**Default:** `false`<br>**Example:** `true`, `false`, `recursive`<br>**Note:** Use `recursive` to recursively checkout submodules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | No       | `false` |
| `checkout-token-resources` | Additional resources the checkout token must be able to read, whitespace-separated.<br>When set, the workflow exchanges its OIDC token at the token broker for an installation token with `contents:read` on this repository plus these resources, and uses it for every checkout.<br>**Default:** _empty_ (no exchange; `GITHUB_TOKEN` is used)<br>**Format:** `repo:owner/name`, `org:name` or `enterprise:slug`<br>**Example:** `repo:my-org/private-submodule repo:my-org/go-lib`<br>**Requires:** `token-broker-url` (or the `TOKEN_BROKER_URL` repository variable), and the token broker's GitHub App installed on this repository and every listed resource<br>**Note:** Unavailable on pull requests from forks, which have no OIDC token; those runs use `GITHUB_TOKEN` | No       | _empty_ |

## Outputs

| Output     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `releases` | Release list v2, a compact JSON array of tallyrelease release entries for publish workflows such as `publish-oci`, `publish-npm` and `publish-linear`.<br>Each entry: {id, path, kind, version, channel, tag, releaseSha, catchUp, forge, latest, tags, group, prs}, see the tallyrelease CLI README for the fields. `prs` holds the pull request numbers of the release's changes, propagated units included.<br>Payloads follow one rule: `payload-source` / `payload-dist`, with `-<releaseSha>` appended when `catchUp` is true. Files are `source.tar` and `<id>.tgz`.<br>`[]` when nothing was released. |
