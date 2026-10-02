# app-monorepo-stack

CI for Yarn + Turborepo monorepos that mix Node.js, Python and Go. It checks, builds and tests the
repository on every pull request. On the default branch it also creates releases and packs whatever
the release contained into payload artifacts, one per target format: npm tarballs and an OCI build
context. It publishes nothing itself; the caller wires the [`npm`](#outputs) and [`oci`](#outputs)
release lists into [`publish-npm`](../publish-npm/README.md) and [`publish-oci`](../publish-oci/README.md),
which own the registries and their credentials.

## Behavior

| Job         | Runs                                                 | Does                                                                                    |
| :---------- | :--------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| `Configure` | Always                                               | Resolves the commit, mode and trust level, validates the Makefile, discovers test types |
| `Check`     | Always                                               | `install-immutable`, dependency checks, `check`, `build` and unit tests                 |
| `Test`      | One job per test type not already covered by `Check` | `install-immutable`, `build` and `test-<type>`                                          |
| `Release`   | Push to `default-branch`, after `Check` and `Test`   | Runs the [`release`](../release/README.md) workflow, which creates or lands release PRs |
| `Pack`      | When the release versioned at least one workspace    | Packs the released packages and apps into artifacts and emits the `npm` and `oci` lists |
| `Status`    | Always                                               | Single required status check, fails when any other job failed or was cancelled          |

- `pull_request_target` is rejected
- Tool versions come from `.tool-versions` (see [setup-tools](../../actions/setup-tools/README.md))
- Unit tests run inside `Check` by default, which avoids a second install and build. Set
  `run-unit-tests-in-build: false` to move them into the `Test` matrix
- If your linter or formatter config lives in a workspace package that has to be compiled first, set
  `run-build-before-check: true`. The order then becomes install, dependency check, build, check,
  unit tests

## Usage

This is a `workflow_call` workflow, so it can't be triggered directly. Call it from a workflow triggered by
`pull_request` and `push` (never `pull_request_target`).

[//]: # "x-release-please-start-major"

```yaml
jobs:
  app-monorepo-stack:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@app-monorepo-stack-v0
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@app-monorepo-stack-v0`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@app-monorepo-stack-v0.0.0`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

Complete, copyable caller workflow `.github/workflows/ci.yaml`. The publish jobs receive empty
release lists on pull requests and on pushes that release nothing, and skip all work. They run with
`!cancelled()` because a partially failed `Pack` fails the `ci` job, and the units that were packed
should still be published.

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
    uses: abinnovision/actions/.github/workflows/workflow.yaml@app-monorepo-stack-v0
    permissions:
      contents: read
      packages: read
      actions: write
      id-token: write

  publish-npm:
    name: Publish npm
    needs: ci
    # Publishes the successfully packed units even when Pack partially failed.
    if: ${{ !cancelled() }}
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-npm-v1
    permissions:
      contents: read
      id-token: write
      packages: write
    with:
      releases: ${{ needs.ci.outputs.npm }}
      npm: true
      ghpr: true

  publish-oci:
    name: Publish OCI
    needs: ci
    # Publishes the successfully packed units even when Pack partially failed.
    if: ${{ !cancelled() }}
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v1
    permissions:
      contents: read
      id-token: write
      packages: write
      actions: write
    with:
      releases: ${{ needs.ci.outputs.oci }}
      registry: ${{ vars.FOUNDRY_REGISTRY_DOCKER }}
      gcp-workload-identity-provider: ${{ vars.FOUNDRY_WIF_PROVIDER }}
      gitops-config: |
        backend,<gitops-repo>,staging,production
```

[//]: # "x-release-please-end"

The resulting check contexts are `CI / Configure`, `CI / Check`, `CI / Test / <type>`,
`CI / Release`, `CI / Pack` and `CI / Status`. Require `CI / Status` and `Commitlint` in your
rulesets.

The workflow takes no secrets. To read other private repositories during checkout, use
[`checkout-token-resources`](#checking-out-other-repositories).

## Triggers

| Event                        | Runs                                       | Actions cache                                                      |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `pull_request`               | `Configure`, `Check`, `Test`               | Read/write in the PR scope, restores from the default branch       |
| `merge_group`                | `Configure`, `Check`, `Test`               | Read/write in the queue scope, restores from the default branch    |
| `push` to the default branch | everything, including `Release` and `Pack` | Read/write in the default branch scope, the cache PRs restore from |
| `pull_request_target`        | Nothing, `Configure` fails                 |                                                                    |

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

Pull requests and merge groups supersede themselves; pushes to the default branch queue instead, so
no release or publish is ever cut short.

### Permissions

The workflow declares `permissions: {}` and grants each job only what it needs. The `ci` job of the
caller must grant the union:

| Permission        | Used by                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `contents: read`  | Every checkout                                                          |
| `packages: read`  | Private GitHub Package Registry dependencies during install             |
| `actions: write`  | Saving entries to the Actions cache and uploading the payload artifacts |
| `id-token: write` | The checkout token exchange and the release workflow's token exchange   |

A called workflow can never exceed its caller's permissions. The publish jobs declare their own
permissions, see [`publish-npm`](../publish-npm/README.md) and [`publish-oci`](../publish-oci/README.md).

### Forks and Dependabot

Pull requests from forks get a read-only token that the `permissions:` key cannot elevate. Cache
saves are skipped with a warning, private submodules do not resolve, and private GitHub Package Registry dependencies are unavailable. Fork runs also have no OIDC token,
so the checkout token exchange is skipped rather than failing and `checkout-token-resources` has no
effect. Those runs restore the default branch cache instead of writing their own.

Dependabot pull requests do honour the `permissions:` key and keep cache writes. They see Dependabot
secrets rather than Actions secrets, which the pull request lane does not need.

`Configure` reports both cases as `trusted: false`. `Check` and `Test` run regardless; nothing on
the pull request lane needs more than the checkout credentials described above.

## Repository layout

### Makefile

Dependency installation goes through `make`, so each repository can define its own strategy across
languages. Two targets are required; `Configure` fails the run if `install-immutable` is missing.

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
├── Makefile              # install and install-immutable targets
├── .tool-versions        # asdf versions: nodejs (required), python, golang, uv
├── packages/             # publishable libraries and shared code
│   └── <name>/package.json
└── apps/                 # deployable applications
    └── <name>/
        ├── package.json
        └── Dockerfile    # required for an OCI payload
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

## Payloads and release lists

`Pack` runs after a successful release that versioned at least one workspace. It reads the
release workflow's `versions` output and selects:

- **Packages**: released directories under `packages/` with a `package.json` that is not
  `"private": true` and whose `publishConfig.language` is `nodejs` or unset
- **Apps**: released directories under `apps/` with both a `package.json` and a `Dockerfile`. A
  released app without a `Dockerfile` gets a notice and no image

Entries follow the [release list protocol](../../docs/stacks/README.md#release-list) (schema 1).
`channel` is the `prerelease-channel` input for prereleases and empty for stable releases. Payload
artifacts are kept for 7 days.

The npm and OCI halves of `Pack` run independently. A package whose `yarn pack` fails or an app whose
`turbo prune` fails is reported with an error and left out of its list, and a failure in one half
does not stop the other. The lists are written for every unit that was packed, then `Pack` fails if
anything did not pack. Steps of the OCI half only run when at least one released app has a
`Dockerfile`, so repositories without images have no OCI requirements.

### npm packages

`Pack` builds `./packages/*` (replayed from the Turborepo cache), stamps the `version` field of every
released package with its released version so `workspace:` ranges resolve to released versions, and
runs `yarn pack` for each selected package. The artifact `npm-packages` contains one `<name>.tgz`
per entry of the `npm` list:

```json
[
  {
    "schema": 1,
    "name": "sdk",
    "version": "1.4.0-beta.5",
    "channel": "beta",
    "sha": "a3f2c1d",
    "artifact": "npm-packages",
    "file": "sdk.tgz"
  }
]
```

Registry selection stays in the package's own `package.json` and is read by `publish-npm` from the
tarball:

```json
{
  "name": "@your-org/package-name",
  "version": "1.0.0",
  "publishConfig": {
    "language": "nodejs",
    "npm": true,
    "ghpr": true,
    "npmAccess": "public"
  }
}
```

| Field       | Meaning                                                           |
| ----------- | ----------------------------------------------------------------- |
| `language`  | `nodejs`, `python`, `golang`, or any string. Defaults to `nodejs` |
| `npm`       | Publish to the public npm registry                                |
| `ghpr`      | Publish to the GitHub Package Registry. Requires a scoped name    |
| `npmAccess` | `public` or `restricted`. Defaults to `public`                    |

Only packages resolving to `nodejs` are packed. Python and Go packages still carry a `package.json`
so they participate in the Yarn workspace graph, Turbo's task scheduling and release-please
versioning, but their real artifacts are built by their own toolchain.

### OCI build context

For every selected app, `Pack` runs `turbo prune --docker` into `out/<app-name>/`, which contains a
`json/` directory with package manifests and a `full/` directory with sources. Turbo must be a
dependency in the root `package.json`, every app needs a `name` in its `package.json`, and
`.tool-versions` must list `nodejs`.

The artifact `oci-context` contains `context.tar`: every tracked file of the repository (including
submodules) plus `out/`. It is created before any version stamping, so image layer caches stay
stable across releases. Untracked files, such as `node_modules`, are not part of the context. Each
entry of the `oci` list carries an `oci` block with the image name `app-<name>`:

```json
[
  {
    "schema": 1,
    "name": "backend",
    "version": "1.4.0",
    "channel": "",
    "sha": "a3f2c1d",
    "artifact": "oci-context",
    "file": "context.tar",
    "oci": {
      "image": "app-backend",
      "file": "apps/backend/Dockerfile",
      "context": ".",
      "build-args": {
        "app_name": "backend",
        "node_version": "24.20.0",
        "python_version": "",
        "golang_version": "",
        "uv_version": "",
        "build_version": "v1.4.0+a3f2c1d",
        "build_commit": "a3f2c1d"
      },
      "turbo-cache": true
    }
  }
]
```

### Build arguments

| Argument         | Source                                         |
| ---------------- | ---------------------------------------------- |
| `app_name`       | App directory name                             |
| `node_version`   | `.tool-versions`, required                     |
| `python_version` | `.tool-versions`, empty when not present       |
| `golang_version` | `.tool-versions`, empty when not present       |
| `uv_version`     | `.tool-versions`, empty when not present       |
| `build_version`  | Semantic version with commit, `v1.2.3+abc1234` |
| `build_commit`   | Short commit SHA                               |

```dockerfile
ARG node_version
ARG python_version

FROM node:${node_version}-alpine AS node-builder
FROM python:${python_version}-slim AS python-builder
```

### Turbo remote cache inside the build

Every `oci` entry sets `oci.turbo-cache: true`. `publish-oci` then starts a runner-local Turborepo
cache proxy backed by the Actions cache, runs the buildx builder with `network=host` and passes
`TURBO_API`, `TURBO_TEAM` and `TURBO_TOKEN` as build arguments. These are plain build arguments
rather than BuildKit secrets; the token is a session identifier for the local proxy, not a
credential.

Using them is opt-in per app. The `Dockerfile` must declare `# syntax=docker/dockerfile:1.4` or newer
as its first line, accept the three arguments, and mark the build instruction `--network=host`:

```dockerfile
ARG TURBO_API
ARG TURBO_TEAM
ARG TURBO_TOKEN
ENV TURBO_API=${TURBO_API}
ENV TURBO_TEAM=${TURBO_TEAM}
ENV TURBO_TOKEN=${TURBO_TOKEN}

RUN --network=host turbo build
```

Without `--network=host` the build cannot reach the proxy and Turbo silently falls back to a
local-only cache. Dockerfiles that ignore these arguments are unaffected.

Per-app build secrets are configured on `publish-oci` through its `APP_IMAGE_SECRETS` secret.

## Checking out other repositories

By default every checkout uses the job's `GITHUB_TOKEN`, which only reaches the calling repository.
Repositories with private git submodules, private Go modules or other git-based dependencies need
wider access. Set `checkout-token-resources` and the workflow exchanges its OIDC token at the token
broker for a short-lived installation token with `contents:read` on this repository plus everything
listed, and uses that token for every checkout.

```yaml
with:
  checkout-submodules: recursive
  checkout-token-resources: repo:my-org/private-submodule repo:my-org/go-lib
```

Resources are whitespace-separated and use typed prefixes: `repo:owner/name` for a single
repository, `org:name` for an entire organisation, `enterprise:slug` for an enterprise. The calling
repository is always included, so it never has to be listed. Prefer `repo:`: the token is persisted
as a git credential for the whole job, so an `org:` or `enterprise:` grant lets every later step,
including test code, read everything under it.

This requires `token-broker-url` (or the `TOKEN_BROKER_URL` repository variable), and the token
broker's GitHub App must be installed on every resource you list. `actions/checkout` persists the
token as a git credential for `github.com`, so submodule and `go mod download` fetches over HTTPS
pick it up without any further setup.

Pull requests from forks have no OIDC token, so the exchange is skipped there and checkout uses the
read-only `GITHUB_TOKEN`.

Private GitHub Package Registry dependencies are a separate concern; they authenticate with the job
`GITHUB_TOKEN` and are unaffected by this input.

## Migrating from polyglot-monorepo-stack

- Call `app-monorepo-stack` instead of `polyglot-monorepo-stack`.
- Rename the caller to `.github/workflows/ci.yaml` with `name: CI`, trigger it on `pull_request`
  and `push`, and follow the [example](#example-workflow-file). `pull_request_target` now fails in
  `Configure`.
- The required status check becomes `CI / Status` (plus `Commitlint`).
- Publishing moved to separate workflows that the caller wires to this workflow's outputs:

| Removed input or secret                                  | Replacement                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| `enable-package-publishing`                              | Add a `publish-npm` job with `releases: needs.ci.outputs.npm` |
| `enable-packages-registry-npm`                           | `publish-npm` input `npm`                                     |
| `enable-packages-registry-npm-provenance`                | `publish-npm` input `provenance`                              |
| `enable-packages-registry-ghpr`                          | `publish-npm` input `ghpr`                                    |
| `enable-app-image-builds`                                | Add a `publish-oci` job with `releases: needs.ci.outputs.oci` |
| `enable-apps-registry-ghcr`                              | `publish-oci` input `ghcr`                                    |
| `enable-apps-registry-gcpar`, `registry-gcpar-url`       | `publish-oci` input `registry`                                |
| `gcp-workload-identity-provider`, `gcp-auth`             | `publish-oci` inputs of the same name                         |
| `gitops-app-config`                                      | `publish-oci` input `gitops-config` (registry column removed) |
| `gitops-workflow-file`                                   | `publish-oci` input `gitops-workflow-file`                    |
| `APP_IMAGE_SECRETS`                                      | `publish-oci` secret `APP_IMAGE_SECRETS`                      |
| `CHECKOUT_TOKEN`                                         | Input `checkout-token-resources`                              |
| `enable-apps-registry-dockerhub`, `registry-dockerhub-*` | Not available; stay on `polyglot-monorepo-stack` if needed    |
| `REGISTRY_DOCKERHUB_TOKEN`                               | Not available; stay on `polyglot-monorepo-stack` if needed    |
| `enable-gh-pages`, `gh-pages-build-output`               | Not available; stay on `polyglot-monorepo-stack` if needed    |

## Inputs

| Input                      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Required | Default |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------ |
| `token-broker-url`         | URL of the token broker for OIDC token exchange.<br>**Default:** Falls back to `vars.TOKEN_BROKER_URL` if not provided.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | _empty_ |
| `default-branch`           | Default branch name for the repository.<br>**Default:** `main`<br>**Example:** `main`, `master`, `develop`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | No       | `main`  |
| `test-types`               | Comma-separated list of test types to run.<br>**Valid values:** `unit`, `integration`, `e2e`<br>**Default:** `unit`<br>**Example:** `unit,integration,e2e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | No       | `unit`  |
| `run-unit-tests-in-build`  | Run unit tests as part of the check job instead of a separate job.<br>Recommended for smaller monorepos to reduce overall execution time.<br>**Default:** `true`<br>**Note:** You must include `unit` in the `test-types` input for this to have any effect.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | No       | `true`  |
| `run-build-before-check`   | Run the build step before the check step in the check job.<br>Useful for monorepos where eslint/prettier/etc config packages must be built before linters can run.<br>**Default:** `false`<br>**Note:** When enabled, the order becomes: Install → Dependencies Check → Build → Check → Unit Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | No       | _empty_ |
| `checkout-submodules`      | Whether to checkout submodules.<br>**Default:** `false`<br>**Example:** `true`, `false`, `recursive`<br>**Note:** Use `recursive` to recursively checkout submodules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | No       | `false` |
| `checkout-token-resources` | Additional resources the checkout token must be able to read, whitespace-separated.<br>When set, the workflow exchanges its OIDC token at the token broker for an installation token with `contents:read` on this repository plus these resources, and uses it for every checkout.<br>**Default:** _empty_ (no exchange; `GITHUB_TOKEN` is used)<br>**Format:** `repo:owner/name`, `org:name` or `enterprise:slug`<br>**Example:** `repo:my-org/private-submodule repo:my-org/go-lib`<br>**Requires:** `token-broker-url` (or the `TOKEN_BROKER_URL` repository variable), and the token broker's GitHub App installed on this repository and every listed resource<br>**Note:** Unavailable on pull requests from forks, which have no OIDC token; those runs use `GITHUB_TOKEN` | No       | _empty_ |
| `prerelease-channel`       | Prerelease channel name (e.g., "beta", "canary", "rc").<br>When set, computes prerelease versions and sets the channel of prerelease entries in the release lists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | No       | _empty_ |

## Outputs

| Output     | Description                                                                                                                                                                                                                                                                                        |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `versions` | JSON object mapping released/prerelease package paths to version info.<br>Each entry: {version: "semver+sha", packageVersion: "clean semver", type: "release"\|"prerelease", sha: "short commit SHA"}.<br>Empty object {} when nothing was released.                                               |
| `npm`      | Release list (schema 1) of packed npm packages, a compact JSON array for `publish-npm`.<br>Each entry: {schema: 1, name, version, channel, sha, artifact: "npm-packages", file: "<name>.tgz"}.<br>Empty when nothing was packed.                                                                   |
| `oci`      | Release list (schema 1) of released apps with a Dockerfile, a compact JSON array for `publish-oci`.<br>Each entry: {schema: 1, name, version, channel, sha, artifact: "oci-context", file: "context.tar", oci: {image, file, context, build-args, turbo-cache}}.<br>Empty when nothing was packed. |
