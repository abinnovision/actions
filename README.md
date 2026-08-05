# polyglot-monorepo-stack

CI/CD for Yarn + Turborepo monorepos that mix Node.js, Python and Go. It checks and builds the
repository on every pull request, and on the default branch it also creates releases and publishes
whatever the release contained: npm packages, container images, and GitOps deployment dispatches.

## Quick start

Add the trigger block and the job to `.github/workflows/build.yaml`:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

[//]: # "x-release-please-start-major"

```yaml
jobs:
  polyglot-monorepo-stack:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@polyglot-monorepo-stack-v2
```

[//]: # "x-release-please-end"

Add `secrets: inherit` to the job if you use any of the optional [secrets](#secrets), such as a
custom checkout token or per-app image build secrets.

The repository must also meet the [layout requirements](#repository-layout). Everything beyond that
is opt-in through [inputs](#inputs).

## Triggers

| Event                        | Runs                                      | Actions cache                                                      |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `pull_request`               | `configure`, `check_build`, `test`        | Read/write in the PR scope, restores from the default branch       |
| `merge_group`                | `configure`, `check_build`, `test`        | Read/write in the queue scope, restores from the default branch    |
| `push` to the default branch | everything, including release and publish | Read/write in the default branch scope, the cache PRs restore from |

Releasing and publishing are gated inside the workflow on `push` to `default-branch`, so a pull
request can never reach them regardless of how it was triggered.

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

The jobs request `contents: read`, `packages: read` and `actions: write`, plus `contents: write`,
`packages: write`, `id-token: write` and `pages: write` in the publishing jobs. `actions: write` is
what the Actions cache service requires to save entries.

A called workflow can never exceed its caller's permissions. The calling repository must therefore
either keep the default "Read and write permissions" setting for `GITHUB_TOKEN`, or declare a
top-level `permissions:` block that covers those scopes.

### Forks and Dependabot

Pull requests from forks get a read-only token that the `permissions:` key cannot elevate. Cache
saves are skipped with a warning, `CHECKOUT_TOKEN` is empty so private submodules do not resolve,
and private GitHub Package Registry dependencies are unavailable. Those runs restore the default
branch cache instead of writing their own.

Dependabot pull requests do honour the `permissions:` key and keep cache writes. They see Dependabot
secrets rather than Actions secrets, which the pull request lane does not need.

## Repository layout

### Makefile

Dependency installation goes through `make`, so each repository can define its own strategy across
languages. Two targets are required; `configure` fails the run if `install-immutable` is missing.

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
    ├── <name>/
    │   ├── package.json
    │   └── Dockerfile    # required for container image builds
    └── <docs>/package.json   # gh-pages apps need no Dockerfile
```

The `configure` job discovers workspaces by these rules:

- A directory under `packages/` counts as a package if it has a `package.json`.
- A directory under `apps/` counts as an image-buildable app if it has both a `package.json` and a
  `Dockerfile`.
- An app is a Pages app if its `package.json` declares `"publishConfig": { "platform": "gh-pages" }`.
- Packages marked `"private": true` are never published.

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

## Pipeline

| Job           | When                                                                             |
| ------------- | -------------------------------------------------------------------------------- |
| `configure`   | Always. Resolves the commit, validates the Makefile, discovers workspaces        |
| `check_build` | Always. `install-immutable`, dependency checks, `check`, `build`, and unit tests |
| `test`        | One parallel job per test type not already covered by `check_build`              |
| `release`     | Push to the default branch only. Creates or lands release PRs                    |
| `publish_*`   | Only for workspaces the release actually versioned                               |

Unit tests run inside `check_build` by default rather than as their own job, which avoids a second
install and build. Set `run-unit-tests-in-build: false` to move them into the `test` matrix.

If your linter or formatter config lives in a workspace package that has to be compiled first, set
`run-build-before-check: true`. The order then becomes install, dependency check, build, check,
unit tests.

## Publishing packages

Enable with `enable-package-publishing`, then enable at least one registry
(`enable-packages-registry-npm`, `enable-packages-registry-ghpr`). Both the workflow input and the
package's own `publishConfig` must agree before anything is published.

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

Only packages resolving to `nodejs` are published. Python and Go packages still carry a
`package.json` so they participate in the Yarn workspace graph, Turbo's task scheduling and
release-please versioning, but the publish step skips them and their real artifacts are built by
their own toolchain.

### npm trusted publishers

Publishing to npmjs.com uses GitHub OIDC through
[trusted publishers](https://docs.npmjs.com/trusted-publishers), so no `NPM_TOKEN` is involved. Each
package needs a one-time setup on npmjs.com under Settings → Trusted Publishers: add a GitHub Actions
publisher with owner `abinnovision`, repository `actions`, workflow filename
`.github/workflows/workflow.yaml`, and no environment.

This requires Yarn 4.10.3 or newer in your `packageManager` field. Earlier versions do not implement
the npm OIDC token exchange and authentication fails.

Provenance attestations are generated by default and show up as a badge on npmjs.com linking back to
the run that built the version. Turn `enable-packages-registry-npm-provenance` off for packages that
cannot meet npm's provenance requirements.

## Publishing container images

Enable with `enable-app-image-builds` plus at least one of `enable-apps-registry-ghcr`,
`enable-apps-registry-dockerhub` or `enable-apps-registry-gcpar`. Images are built only for apps
that the release actually versioned, and each image is tagged with both its commit SHA and its
semantic version.

Before building, the workflow runs `turbo prune --docker` for the app and builds from the pruned
tree in `out/<app-name>/`, which contains a `json/` directory with package manifests and a `full/`
directory with sources. Turbo must be a dependency in the root `package.json` and every app needs a
`name` in its `package.json`.

### Build arguments

| Argument         | Source                                         |
| ---------------- | ---------------------------------------------- |
| `app_name`       | App directory name                             |
| `node_version`   | `.tool-versions`, required                     |
| `python_version` | `.tool-versions`, optional                     |
| `golang_version` | `.tool-versions`, optional                     |
| `uv_version`     | `.tool-versions`, optional                     |
| `build_version`  | Semantic version with commit, `v1.2.3-abc1234` |
| `build_commit`   | Full commit SHA                                |

```dockerfile
ARG node_version
ARG python_version

FROM node:${node_version}-alpine AS node-builder
FROM python:${python_version}-slim AS python-builder
```

### Build secrets

Per-app build-time secrets come from the `APP_IMAGE_SECRETS` secret, in CSV format, one per line:

```
api,NPM_TOKEN,npm_abc123xyz
api,SENTRY_TOKEN,abc123
frontend,API_KEY,secret,with,commas,is,fine
```

Only the first two commas are delimiters, so values may contain commas. Each entry becomes its own
BuildKit secret mount, available at `/run/secrets/<name>` and never written to an image layer:

```dockerfile
RUN --mount=type=secret,id=NPM_TOKEN \
    npm config set //registry.npmjs.org/:_authToken $(cat /run/secrets/NPM_TOKEN)
```

### Turbo remote cache inside the build

`Setup Tools` starts a runner-local Turborepo cache proxy backed by the Actions cache. The buildx
builder runs with `network=host` and the build receives `TURBO_API`, `TURBO_TEAM` and `TURBO_TOKEN`
pointing at that proxy. These are plain build arguments rather than BuildKit secrets; the token is a
session identifier for the local proxy, not a credential.

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

## Publishing to GitHub Pages

A static app opts in by declaring `"publishConfig": { "platform": "gh-pages" }`, matching the
`publishConfig.language` convention used by packages. Set `enable-gh-pages: true` on the workflow,
and `gh-pages-build-output` if the build writes somewhere other than `dist`.

```json
{
  "name": "@your-org/docs",
  "publishConfig": { "platform": "gh-pages" },
  "scripts": { "build": "vitepress build" }
}
```

Only one app per repository may declare the platform. `configure` fails immediately if it finds more,
since release tracking would otherwise be ambiguous. Deployment is gated on the app being part of a
release, and prereleases are excluded, so the published site always reflects a tagged version. The
repository also needs Pages enabled with GitHub Actions as the source, plus a `github-pages`
environment under Settings → Environments.

## Dispatching GitOps updates

After images are published, the workflow can trigger a deployment workflow in a GitOps repository.
Configure it with `gitops-app-config` in CSV format, one line per app:

```
app-name,target-repo,dev-application,release-application,registry,image-name
```

Only the first five commas are delimiters. A `target-repo` without a slash is resolved against the
current repository owner. Valid registries are `ghcr`, `gcpar` and `dockerhub`. Apps with incomplete
rows are skipped with a warning.

Releases dispatch against `release-application` and prereleases against `dev-application`. Apps
sharing a target repository and application are batched into one dispatch, and the dispatch only
happens if every image in the release was published, so a partial release never reaches your
cluster.

This requires `token-broker-url` (or the `TOKEN_BROKER_URL` repository variable), which the workflow
uses to exchange an OIDC token for one scoped to the target repositories. The dispatched workflow
defaults to `update-tags.yaml` and receives `application` and `updates` inputs.

## Versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@polyglot-monorepo-stack-v2`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@polyglot-monorepo-stack-v2.1.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Required | Default            |
| :---------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------------- |
| `token-broker-url`                        | URL of the token broker for OIDC token exchange.<br>**Default:** Falls back to `vars.TOKEN_BROKER_URL` if not provided.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | No       | _empty_            |
| `default-branch`                          | Default branch name for the repository.<br>**Default:** `main`<br>**Example:** `main`, `master`, `develop`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | No       | `main`             |
| `test-types`                              | Comma-separated list of test types to run.<br>**Valid values:** `unit`, `integration`, `e2e`<br>**Default:** `unit`<br>**Example:** `unit,integration,e2e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | No       | `unit`             |
| `run-unit-tests-in-build`                 | Run unit tests as part of the build step instead of a separate job.<br>Recommended for smaller monorepos to reduce overall execution time.<br>**Default:** `true`<br>**Note:** You must include `unit` in the `test-types` input for this to have any effect.                                                                                                                                                                                                                                                                                                                                                                                                                                 | No       | `true`             |
| `run-build-before-check`                  | Run the build step before the check step in the check_build job.<br>Useful for monorepos where eslint/prettier/etc config packages must be built before linters can run.<br>**Default:** `false`<br>**Note:** When enabled, the build order becomes: Install → Dependencies Check → Build → Check → Unit Tests                                                                                                                                                                                                                                                                                                                                                                                | No       | _empty_            |
| `enable-package-publishing`               | Enable publishing packages to configured registries.<br>**Default:** `false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | No       | _empty_            |
| `enable-packages-registry-npm`            | Enable publishing packages to NPM registry.<br>**Default:** `false`<br>**Authentication:** Uses GitHub OIDC via [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers); register this reusable workflow for the package on npmjs.com.<br>**Provenance:** Controlled by `enable-packages-registry-npm-provenance` (default `true`).<br>**Requirements:** Yarn ≥ 4.10.3 in the consumer's `packageManager` field for OIDC support.                                                                                                                                                                                                                                                 | No       | _empty_            |
| `enable-packages-registry-npm-provenance` | Generate npm provenance attestations when publishing to the NPM registry.<br>**Default:** `true`<br>**Requires:** `enable-packages-registry-npm: true`, a public package, and the job's `id-token: write` permission (already set).<br>Disable only if the package can't meet npm's provenance requirements.                                                                                                                                                                                                                                                                                                                                                                                  | No       | `true`             |
| `enable-packages-registry-ghpr`           | Enable publishing packages to GitHub Package Registry.<br>**Default:** `false`<br>**Authentication:** Uses `GITHUB_TOKEN` (automatically available)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | _empty_            |
| `enable-app-image-builds`                 | Enable building and publishing Docker images for apps.<br>**Default:** `false`<br>**Note:** At least one registry must be enabled (`ghcr`, `dockerhub`, or `gcpar`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | _empty_            |
| `enable-apps-registry-ghcr`               | Enable publishing Docker images to GitHub Container Registry (GHCR).<br>**Default:** `false`<br>**Authentication:** Uses `GITHUB_TOKEN` (automatically available)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | No       | _empty_            |
| `enable-apps-registry-dockerhub`          | Enable publishing Docker images to DockerHub.<br>**Default:** `false`<br>**Requires:** `REGISTRY_DOCKERHUB_TOKEN` secret and `registry-dockerhub-username` input                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | No       | _empty_            |
| `registry-dockerhub-username`             | DockerHub username for authentication.<br>**Required:** When `enable-apps-registry-dockerhub` is enabled<br>**Example:** `myusername`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | No       | _empty_            |
| `registry-dockerhub-url`                  | DockerHub registry URL.<br>**Default:** `docker.io`<br>**Example:** `docker.io`, `registry.hub.docker.com`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | No       | `docker.io`        |
| `enable-apps-registry-gcpar`              | Enable publishing Docker images to GCP Artifact Registry.<br>**Default:** `false`<br>**Requires:** `registry-gcpar-url` and `gcp-auth` inputs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No       | _empty_            |
| `registry-gcpar-url`                      | GCP Artifact Registry URL for Docker images.<br>**Required:** When `enable-apps-registry-gcpar` is enabled<br>**Example:** `europe-west4-docker.pkg.dev/project-id/repository-name`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | _empty_            |
| `gcp-auth`                                | GCP authentication configuration (Workload Identity Federation).<br>This is public configuration, not a secret.<br>**Required:** When `enable-apps-registry-gcpar` is enabled<br>**Note:** Can be reused for other GCP services in the workflow<br>**Example:** `projects/123456789/locations/global/workloadIdentityPools/pool-id/providers/provider-id`                                                                                                                                                                                                                                                                                                                                     | No       | _empty_            |
| `gitops-workflow-file`                    | GitOps workflow file to dispatch for deployment updates.<br>**Default:** `update-tags.yaml`<br>**Example:** `update-tags.yaml`, `deploy.yaml`<br>**Note:** Only used when `gitops-app-config` is provided                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | No       | `update-tags.yaml` |
| `gitops-app-config`                       | Per-app GitOps configuration in **CSV format** (one per line).<br>**Format:** `app-name,target-repo,dev-application,release-application,registry,image-name`<br>**Example:**<br>`my-api,my-gitops-repo,my-api-dev,my-api-prod,ghcr,app-my-api`<br>`my-worker,my-gitops-repo,worker-dev,worker-prod,gcpar,app-my-worker`<br>**Registry options:** `ghcr`, `gcpar`, `dockerhub`<br>**Deployment tags:** Dev deployments use `sha-*` tags, release deployments use semver `v*.*.*` tags<br>**Note:** Only first 5 commas are delimiters; remaining fields can contain commas<br>**Important:** All fields are required. GitOps deployment will be skipped for apps with incomplete configuration | No       | _empty_            |
| `checkout-submodules`                     | Whether to checkout submodules.<br>**Default:** `false`<br>**Example:** `true`, `false`, `recursive`<br>**Note:** Use `recursive` to recursively checkout submodules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | No       | `false`            |
| `prerelease-channel`                      | Prerelease channel name (e.g., "beta", "canary", "rc").<br>When set, computes prerelease versions and publishes with corresponding dist-tags.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No       | _empty_            |
| `enable-gh-pages`                         | Enable building and deploying static apps to GitHub Pages.<br>**Default:** `false`<br>**Requirements:** App must have `"publishConfig": { "platform": "gh-pages" }` in its `package.json`.<br>The `github-pages` environment must exist in the repository settings.                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | _empty_            |
| `gh-pages-build-output`                   | Relative path within the app directory where the static build output is written.<br>**Default:** `dist`<br>**Example:** `dist`, `build`, `out`, `.next`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | No       | `dist`             |

## Secrets

| Secret                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Required |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `REGISTRY_DOCKERHUB_TOKEN` | DockerHub registry authentication token for publishing Docker images.<br>**Required:** When `enable-apps-registry-dockerhub` is enabled<br>**Example:** `dckr_pat_1a2b3c4d5e6f7g8h9i0j`                                                                                                                                                                                                                                                                                                                                                                                                      | No       |
| `APP_IMAGE_SECRETS`        | App-specific build secrets for Docker image builds in **CSV format** (one per line).<br>**Format:** `app-name,secret-name,secret-value`<br>**Example:**<br>`<br>my-api,NPM_TOKEN,npm_abc123xyz<br>my-api,API_KEY,secret_key_here<br>my-frontend,BUILD_KEY,value,with,commas,is,ok<br>`<br>**Note:** Only the first two commas are delimiters; the secret value can contain commas.<br><br>Each secret is passed to Docker BuildKit as an individual secret mount with its own ID.<br><br>**Usage in Dockerfile:** `--mount=type=secret,id=NPM_TOKEN` (available at `/run/secrets/NPM_TOKEN`) | No       |
| `CHECKOUT_TOKEN`           | Access token to use for checkout.<br>**Default:** `Github Token`<br>**Note:** PAT requires an expiration date.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | No       |

## Outputs

| Output     | Description                                                                                                                                                                                                                                          |
| :--------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `versions` | JSON object mapping released/prerelease package paths to version info.<br>Each entry: {version: "semver+sha", packageVersion: "clean semver", type: "release"\|"prerelease", sha: "short commit SHA"}.<br>Empty object {} when nothing was released. |
