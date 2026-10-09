# app-stack

CI for Yarn repositories: Turborepo monorepos that mix Node.js, Python and Go, and
[single-package repositories](#single-package-repositories). It checks, builds and tests the
repository on every pull request. On every push to the default branch it also packs the
[units](#units) into two target-neutral payloads and creates releases. It publishes nothing itself;
the caller wires the [`releases`](#outputs) list into [`publish-oci`](../publish-oci/README.md) and
[`publish-npm`](../publish-npm/README.md), which own the registries and their credentials.

It follows the shared [stack contract](../../docs/stacks/README.md) for calling, naming, jobs and required checks.

## Behavior

| Job         | Runs                                                 | Does                                                                                                                                           |
| :---------- | :--------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `Configure` | Always                                               | Resolves the commit and mode, validates the Makefile if present, resolves the units, discovers test types                                      |
| `Check`     | Always                                               | Install, dependency checks, `build`, `check` and unit tests; on push to `default-branch` also prunes the source units and packs the dist units |
| `Test`      | One job per test type not already covered by `Check` | Install, `build` and `test-<type>`                                                                                                             |
| `Release`   | Push to `default-branch`, after `Check` and `Test`   | Runs release-please, which creates or lands release PRs and creates the releases, then writes the `releases` list                              |
| `Status`    | Always                                               | Single required status check, fails when any other job failed or was cancelled                                                                 |

- Unit tests run inside `Check` by default, which avoids a second install and build. Set
  `run-unit-tests-in-build: false` to move them into the `Test` matrix
- `Check` builds before it checks, so linter and formatter config that lives in a compiled workspace
  package is always available

## Requirements

- The repository has a `.tool-versions` file with `nodejs` and a root `package.json` with `build` and `check` scripts,
  see [Repository layout](#repository-layout)
- release-please is configured as described in [Releases](../../docs/stacks/README.md#releases)
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
- `abinnovision/actions/.github/workflows/workflow.yaml@app-stack-v1.0.3`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

Complete, copyable caller workflow `.github/workflows/ci.yaml`. Both publish jobs receive the same
`releases` list and select their entries with their `include` input. The list is empty on pull
requests and on pushes that release nothing, and the publish jobs then skip all work.

[//]: # "x-release-please-start-major"

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
    uses: abinnovision/actions/.github/workflows/workflow.yaml@app-stack-v1
    permissions:
      contents: read
      packages: read
      actions: write
      id-token: write

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

  publish-oci:
    name: Publish OCI
    needs: ci
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v1
    permissions:
      contents: read
      id-token: write
      packages: write
      actions: write
    with:
      releases: ${{ needs.ci.outputs.releases }}
      image: app-{name}
      registry: ${{ vars.FOUNDRY_REGISTRY_DOCKER }}
      gcp-workload-identity-provider: ${{ vars.FOUNDRY_WIF_PROVIDER }}
      gitops-config: |
        backend,<gitops-repo>,staging,production
```

[//]: # "x-release-please-end"

The resulting check contexts are `CI / Configure`, `CI / Check`, `CI / Test: <type>`,
`CI / Release` and `CI / Status`. Require `CI / Status` and
`Lint commits` in your rulesets.

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
├── packages/             # dist units by default
│   └── <name>/package.json
└── apps/                 # source units by default
    └── <name>/
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

| Event                        | Runs                            | Actions cache                                                      |
| ---------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `pull_request`               | `Configure`, `Check`, `Test`    | Read/write in the PR scope, restores from the default branch       |
| `merge_group`                | `Configure`, `Check`, `Test`    | Read/write in the queue scope, restores from the default branch    |
| `push` to the default branch | everything, including `Release` | Read/write in the default branch scope, the cache PRs restore from |
| `pull_request_target`        | Nothing, `Configure` fails      |                                                                    |

Releasing and packing are gated inside the workflow on `push` to `default-branch`, so a pull request
can never reach them.

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

Pull requests and merge groups supersede themselves; a running push to the default branch is never
cancelled. GitHub keeps only one pending run per group, though: when several pushes land while a run
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
| `id-token: write` | The checkout token exchange and the release token exchange              |

A called workflow can never exceed its caller's permissions. The publish jobs declare their own
permissions, see [`publish-npm`](../publish-npm/README.md) and [`publish-oci`](../publish-oci/README.md).

### Forks and Dependabot

Pull requests from forks get a read-only token and no OIDC token: cache saves are skipped, private
submodules and private GitHub Package Registry dependencies do not resolve, and the checkout token
exchange is skipped. Dependabot pull requests keep cache writes. `Check` and `Test` run regardless.

## Units

A unit is a directory with a `package.json`. Two inputs select them, one directory pattern per line,
where `*` matches exactly one path segment:

| Input          | Default      | On push to `default-branch`                                             |
| :------------- | :----------- | :---------------------------------------------------------------------- |
| `source-units` | `apps/*`     | `Check` runs `turbo prune --docker` per unit into the source payload    |
| `dist-units`   | `packages/*` | `Check` runs `yarn pack` per unit after its build into the dist payload |

```yaml
with:
  source-units: |
    apps/*
    services/*
```

Every source unit needs a `name` in its `package.json`, and Turbo must be a dependency in the root
`package.json`. Basenames must be unique within the source units and within the dist units;
`Configure` fails otherwise. Packing is not filtered by `private`. `turbo boundaries` runs in `Check`
when Turbo is a dependency.

### Single-package repositories

The pattern `.` selects the repository root as a unit. Its `name` is the repository name, since the
root has no directory basename, and its dist tarball is `<repository>.tgz`. A root source unit is not
pruned; the source payload already holds the whole tree. Turbo and a Makefile are not needed.

```yaml
with:
  source-units: ""
  dist-units: .
```

Use `source-units: .` instead when the root has a `Dockerfile` for `publish-oci`. The publish
workflows select the root entry with `include: .`; in `publish-oci` use `{name}`, not `{path}`, in `image`. release-please must release the root package,
keyed `.` in `release-please-config.json`.

## Publishing

The payloads, the `releases` list and the rules of the publish workflows are described in the
[publish protocol](../../docs/stacks/README.md#publishing). Every released workspace is listed, with
`payloads.source` when it is a source unit and `payloads.dist` when it is a dist unit. A failing
`yarn pack` or prune fails the run before anything is released.

## Dockerfiles

`publish-oci` builds each image from the source payload with `<path>/Dockerfile`, using the tar
root as build context. A Dockerfile copies from the pruned `out/<name>/` tree: `json/` and the
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

## Inputs

| Input                      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Required | Default      |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------- |
| `token-broker-url`         | URL of the token broker for OIDC token exchange.<br>**Default:** Falls back to `vars.TOKEN_BROKER_URL` if not provided.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | _empty_      |
| `default-branch`           | Default branch name for the repository.<br>**Default:** `main`<br>**Example:** `main`, `master`, `develop`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | No       | `main`       |
| `test-types`               | Comma-separated list of test types to run.<br>**Valid values:** `unit`, `integration`, `e2e`<br>**Default:** `unit`<br>**Example:** `unit,integration,e2e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | No       | `unit`       |
| `run-unit-tests-in-build`  | Run unit tests as part of the check job instead of a separate job.<br>Recommended for smaller monorepos to reduce overall execution time.<br>**Default:** `true`<br>**Note:** You must include `unit` in the `test-types` input for this to have any effect.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | No       | `true`       |
| `checkout-submodules`      | Whether to checkout submodules.<br>**Default:** `false`<br>**Example:** `true`, `false`, `recursive`<br>**Note:** Use `recursive` to recursively checkout submodules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | No       | `false`      |
| `checkout-token-resources` | Additional resources the checkout token must be able to read, whitespace-separated.<br>When set, the workflow exchanges its OIDC token at the token broker for an installation token with `contents:read` on this repository plus these resources, and uses it for every checkout.<br>**Default:** _empty_ (no exchange; `GITHUB_TOKEN` is used)<br>**Format:** `repo:owner/name`, `org:name` or `enterprise:slug`<br>**Example:** `repo:my-org/private-submodule repo:my-org/go-lib`<br>**Requires:** `token-broker-url` (or the `TOKEN_BROKER_URL` repository variable), and the token broker's GitHub App installed on this repository and every listed resource<br>**Note:** Unavailable on pull requests from forks, which have no OIDC token; those runs use `GITHUB_TOKEN` | No       | _empty_      |
| `prerelease-channel`       | Prerelease channel name (e.g., "beta", "canary", "rc").<br>When set, computes prerelease versions and sets the channel of prerelease entries in the release list.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No       | _empty_      |
| `source-units`             | Units pruned into the source payload, one directory pattern per line.<br>`*` matches exactly one path segment. Only directories with a `package.json` count.<br>`.` selects the repository root, which is not pruned: the source payload already holds the whole tree.<br>**Default:** `apps/*`<br>**Example:** `apps/*` and `services/*` on separate lines                                                                                                                                                                                                                                                                                                                                                                                                                       | No       | `apps/*`     |
| `dist-units`               | Units packed into the dist payload, one directory pattern per line.<br>`*` matches exactly one path segment. Only directories with a `package.json` count.<br>`.` selects the repository root.<br>**Default:** `packages/*`<br>**Example:** `packages/*` and `libs/*` on separate lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | `packages/*` |

## Outputs

| Output     | Description                                                                                                                                                                                                                                                                                                                                                                                                           |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `releases` | Release list (schema 1), a compact JSON array with one entry per released unit, for publish workflows such as `publish-oci` and `publish-npm`.<br>Each entry: {schema: 1, name, path, version, channel, sha, payloads}. `name` is the directory basename, the repository name for the root unit `.`.<br>`payloads.source` is set for source units, `payloads.dist` for dist units.<br>`[]` when nothing was released. |
