# node-monorepo-stack

Automate building, validation, and deployment for Node.js monorepos with an opinionated Yarn + Turborepo setup.

This workflow provides a complete CI/CD pipeline for Node.js monorepos, handling:

- Dependency validation and build checks
- Package publishing (for non-private packages)
- Image builds for deployable apps

## Monorepo Requirements

Your repository must follow this structure:

### Package Manager & Build System

- **Yarn (Berry)** - Package manager with workspaces support
- **Turborepo** - Build system for monorepo orchestration and caching
- **`.tool-versions`** - asdf version file (must specify `nodejs` version)

### Directory Structure

```
your-repo/
├── packages/           # Publishable npm packages (libraries, shared code)
│   ├── package-a/
│   │   └── package.json
│   └── package-b/
│       └── package.json
└── apps/              # Deployable applications (Docker images)
├── api/
│   ├── package.json
│   └── Dockerfile    # Required for Docker build
└── web/
├── package.json
└── Dockerfile
```

**Validation Rules:**

- **Packages**: Must contain a `package.json` file
- **Apps**: Must contain both a `package.json` AND a `Dockerfile` to be considered valid for deployment
- **Private packages**: Packages with `"private": true` in package.json will not be published to npm

### Required Scripts

Your root `package.json` must define these scripts:

```json
{
  "scripts": {
    "build": "turbo run build",
    "check": "turbo run lint:check format:check"
  }
}
```

- **`build`** - Compiles all workspaces (packages and apps)
- **`check`** - Runs linting and formatting validation across the monorepo

## Package Publishing Configuration

Packages are published based on their `publishConfig` in `package.json`. The workflow reads these flags to determine which registries to publish to.

### publishConfig Options

```json
{
  "name": "@your-org/package-name",
  "version": "1.0.0",
  "private": false,
  "publishConfig": {
    "npm": true,
    "ghpr": true,
    "npmAccess": "public"
  }
}
```

**Available fields:**

- **`npm`** (boolean) - Publish to NPM registry (requires `enable-packages-registry-npm` and `REGISTRY_NPM_TOKEN`)
- **`ghpr`** (boolean) - Publish to GitHub Package Registry (requires `enable-packages-registry-ghpr`, uses `GITHUB_TOKEN`)
- **`npmAccess`** (string) - Access level for NPM: `"public"` or `"restricted"` (default: `"public"`)

**Important:**

- Packages with `"private": true` are never published, regardless of `publishConfig`
- GitHub Package Registry (ghpr) requires a scoped package name (e.g., `@your-org/package-name`)
- Both workflow-level inputs AND package-level `publishConfig` must be enabled for publishing to occur

## Docker Build Details

**Automatic Turbo Prune:**

- The workflow runs `turbo prune --docker` before building images
- Creates optimized structure in `out/{app-name}/` with `json/` (package files) and `full/` (source)
- Requires Turbo in root `package.json` and package `name` field in each app's `package.json`

**Available Build Arguments:**

- `app_name` - Application name from directory
- `node_version` - From `.tool-versions` file
- `build_version` - Semantic version with commit (e.g., `v1.2.3-abc1234`)
- `build_commit` - Full commit SHA

**App-Specific Secrets:**

- Each app can have its own secrets via GitHub secret named `APP_SECRETS_{app-name}`
- Use standard `.env` format (KEY=VALUE pairs, one per line)
- Example: For app in `apps/api/`, create secret `APP_SECRETS_api`:
  ```
  SENTRY_TOKEN=abc123
  DATABASE_URL=postgres://...
  API_KEY=secret-value
  ```
- Accessed in Dockerfile via BuildKit secret mount: `--mount=type=secret,id=app_secrets`
- Secrets are not stored in image layers

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  node-monorepo-stack:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@node-monorepo-stack-v1
    secrets:
      GH_APP_IDENTIFICATION_RELEASER: ${{ secrets.GH_APP_IDENTIFICATION_RELEASER }}
    # Or to inherit the secrets from the caller:
    secrets: inherit
```

[//]: # "x-release-please-end"

## Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@node-monorepo-stack-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@node-monorepo-stack-v1.0`: Targeting minor version <!-- x-release-please-minor -->
- `abinnovision/actions/.github/workflows/workflow.yaml@node-monorepo-stack-v1.0.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Required | Default            |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------------- |
| `default-branch`                 | Default branch name for the repository.<br>**Default:** `main`<br>**Example:** `main`, `master`, `develop`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | No       | `main`             |
| `test-types`                     | Comma-separated list of test types to run.<br>**Valid values:** `unit`, `integration`, `e2e`<br>**Default:** `unit`<br>**Example:** `unit,integration,e2e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | No       | `unit`             |
| `run-unit-tests-in-build`        | Run unit tests as part of the build step instead of a separate job.<br>Recommended for smaller monorepos to reduce overall execution time.<br>**Default:** `true`<br>**Note:** You must include `unit` in the `test-types` input for this to have any effect.                                                                                                                                                                                                                                                                                                                                                                                                                                       | No       | `true`             |
| `enable-package-publishing`      | Enable publishing packages to configured registries.<br>**Default:** `false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | No       | _empty_            |
| `enable-packages-registry-npm`   | Enable publishing packages to NPM registry.<br>**Default:** `false`<br>**Requires:** `REGISTRY_NPM_TOKEN` secret                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | No       | _empty_            |
| `enable-packages-registry-ghpr`  | Enable publishing packages to GitHub Package Registry.<br>**Default:** `false`<br>**Authentication:** Uses `GITHUB_TOKEN` (automatically available)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No       | _empty_            |
| `enable-app-image-builds`        | Enable building and publishing Docker images for apps.<br>**Default:** `false`<br>**Note:** At least one registry must be enabled (`ghcr`, `dockerhub`, or `gcpar`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No       | _empty_            |
| `enable-apps-registry-ghcr`      | Enable publishing Docker images to GitHub Container Registry (GHCR).<br>**Default:** `true` (automatically available in GitHub Actions)<br>**Authentication:** Uses `GITHUB_TOKEN` (automatically available)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | No       | `true`             |
| `enable-apps-registry-dockerhub` | Enable publishing Docker images to DockerHub.<br>**Default:** `false`<br>**Requires:** `REGISTRY_DOCKERHUB_TOKEN` secret and `registry-dockerhub-username` input                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | No       | _empty_            |
| `registry-dockerhub-username`    | DockerHub username for authentication.<br>**Required:** When `enable-apps-registry-dockerhub` is enabled<br>**Example:** `myusername`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | No       | _empty_            |
| `registry-dockerhub-url`         | DockerHub registry URL.<br>**Default:** `docker.io`<br>**Example:** `docker.io`, `registry.hub.docker.com`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | No       | `docker.io`        |
| `enable-apps-registry-gcpar`     | Enable publishing Docker images to GCP Artifact Registry.<br>**Default:** `false`<br>**Requires:** `registry-gcpar-url` and `gcp-auth` inputs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | No       | _empty_            |
| `registry-gcpar-url`             | GCP Artifact Registry URL for Docker images.<br>**Required:** When `enable-apps-registry-gcpar` is enabled<br>**Example:** `europe-west4-docker.pkg.dev/project-id/repository-name`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No       | _empty_            |
| `gcp-auth`                       | GCP authentication configuration (Workload Identity Federation).<br>This is public configuration, not a secret.<br>**Required:** When `enable-apps-registry-gcpar` is enabled<br>**Note:** Can be reused for other GCP services in the workflow<br>**Example:** `projects/123456789/locations/global/workloadIdentityPools/pool-id/providers/provider-id`                                                                                                                                                                                                                                                                                                                                           | No       | _empty_            |
| `gitops-workflow-file`           | GitOps workflow file to dispatch for deployment updates.<br>**Default:** `update-tags.yaml`<br>**Example:** `update-tags.yaml`, `deploy.yaml`<br>**Note:** Only used when `gitops-app-config` is provided                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | `update-tags.yaml` |
| `gitops-app-config`              | Per-app GitOps configuration in **CSV format** (one per line).<br>**Format:** `app-name,target-repo,dev-application,release-application,registry,image-name`<br>**Example:**<br>`<br>my-api,my-gitops-repo,my-api-dev,my-api-prod,ghcr,app-my-api<br>my-worker,my-gitops-repo,worker-dev,worker-prod,gcpar,app-my-worker<br>`<br>**Registry options:** `ghcr`, `gcpar`, `dockerhub`<br>**Deployment tags:** Dev deployments use `sha-*` tags, release deployments use semver `v*.*.*` tags<br>**Note:** Only first 5 commas are delimiters; remaining fields can contain commas<br>**Important:** All fields are required. GitOps deployment will be skipped for apps with incomplete configuration | No       | _empty_            |

## Secrets

| Secret                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Required |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `GH_APP_IDENTIFICATION_RELEASER` | GitHub App identification for the release workflow.<br>**Required:** Always                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Yes      |
| `REGISTRY_NPM_TOKEN`             | NPM registry authentication token for publishing packages.<br>**Required:** When `enable-packages-registry-npm` is enabled<br>**Example:** `npm_1a2b3c4d5e6f7g8h9i0j`                                                                                                                                                                                                                                                                                                                                                             | No       |
| `REGISTRY_DOCKERHUB_TOKEN`       | DockerHub registry authentication token for publishing Docker images.<br>**Required:** When `enable-apps-registry-dockerhub` is enabled<br>**Example:** `dckr_pat_1a2b3c4d5e6f7g8h9i0j`                                                                                                                                                                                                                                                                                                                                           | No       |
| `APP_IMAGE_SECRETS`              | App-specific build secrets for Docker image builds in **CSV format** (one per line).<br>**Format:** `app-name,secret-name,secret-value`<br>**Example:**<br>`<br>my-api,NPM_TOKEN,npm_abc123xyz<br>my-api,API_KEY,secret_key_here<br>my-frontend,BUILD_KEY,value,with,commas,is,ok<br>`<br>**Note:** Only the first two commas are delimiters; the secret value can contain commas.<br>Secrets are passed to Docker BuildKit via the `app_secrets` secret mount.<br>**Required:** Only when Dockerfiles require build-time secrets | No       |
| `GITOPS_PROXY_URL`               | GitHub Workflow Dispatch Proxy URL for triggering GitOps workflows.<br>**Required:** When `gitops-app-config` is provided<br>**Example:** `https://gwdp.example.com`                                                                                                                                                                                                                                                                                                                                                              | No       |

## Outputs
