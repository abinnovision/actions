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
    uses: abinnovision/actions/.github/workflows/workflow.yaml@node-monorepo-stack-v0
    secrets:
      GH_APP_IDENTIFICATION_RELEASER: ${{ secrets.GH_APP_IDENTIFICATION_RELEASER }}
    # Or to inherit the secrets from the caller:
    secrets: inherit
```

[//]: # "x-release-please-end"

## Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@node-monorepo-stack-v0`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@node-monorepo-stack-v0.0`: Targeting minor version <!-- x-release-please-minor -->
- `abinnovision/actions/.github/workflows/workflow.yaml@node-monorepo-stack-v1.0.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                            | Description                                                                                                                                                                                                                                                                                   | Required | Default               |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :-------------------- |
| `github-token`                   | GitHub token to use for authentication. Defaults to the GITHUB_TOKEN, which is available in all workflows.                                                                                                                                                                                    | No       | `${{ github.token }}` |
| `default-branch`                 | Default branch name. Defaults to "main".                                                                                                                                                                                                                                                      | No       | `main`                |
| `test-types`                     | Comma-separated list of test types to run. Valid values are "unit", "integration", "e2e". By default, only unit tests are run.                                                                                                                                                                | No       | `unit`                |
| `run-unit-tests-in-build`        | If set to 'true', unit tests are run as part of the build step. Otherwise, they are run in a separate job. This is recommended for smaller monorepos, as it reduces the overall execution time. NOTE: You still need to include "unit" in the 'test-types' input for this to have any effect. | No       | `true`                |
| `enable-package-publishing`      | If set to 'true', packages are published to configured registries. Otherwise, the publish step is skipped.                                                                                                                                                                                    | No       | _empty_               |
| `enable-packages-registry-npm`   | If set to 'true', packages are published to NPM registry. Requires REGISTRY_NPM_TOKEN secret.                                                                                                                                                                                                 | No       | _empty_               |
| `enable-packages-registry-ghpr`  | If set to 'true', packages are published to GitHub Package Registry. Uses GITHUB_TOKEN for authentication (automatically available).                                                                                                                                                          | No       | _empty_               |
| `enable-app-image-builds`        | If set to 'true', Docker images are built for apps and published to configured registries. At least one apps registry must be enabled (ghcr, dockerhub, or gcpar).                                                                                                                            | No       | _empty_               |
| `enable-apps-registry-ghcr`      | If set to 'true', Docker images are published to GitHub Container Registry (GHCR). Uses GITHUB_TOKEN for authentication (automatically available). Default: true (free and automatically available in GitHub Actions).                                                                        | No       | `true`                |
| `enable-apps-registry-dockerhub` | If set to 'true', Docker images are published to DockerHub. Requires REGISTRY_DOCKERHUB_TOKEN secret and registry-dockerhub-username input.                                                                                                                                                   | No       | _empty_               |
| `registry-dockerhub-username`    | DockerHub username for authentication. Required if enable-apps-registry-dockerhub is true.                                                                                                                                                                                                    | No       | _empty_               |
| `registry-dockerhub-url`         | DockerHub registry URL. Defaults to 'docker.io'.                                                                                                                                                                                                                                              | No       | `docker.io`           |
| `enable-apps-registry-gcpar`     | If set to 'true', Docker images are published to GCP Artifact Registry. Requires registry-gcpar-url and gcp-auth inputs.                                                                                                                                                                      | No       | _empty_               |
| `registry-gcpar-url`             | GCP Artifact Registry URL for Docker images (e.g., 'europe-west4-docker.pkg.dev/project-id/repository-name'). Required if enable-apps-registry-gcpar is true.                                                                                                                                 | No       | _empty_               |
| `gcp-auth`                       | GCP authentication configuration (Workload Identity Federation). This is public configuration, not a secret. Required if enable-apps-registry-gcpar is true. Can be reused for other GCP services in the workflow.                                                                            | No       | _empty_               |

## Secrets

| Secret                           | Description                                                                                                               | Required |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------ | :------- |
| `GH_APP_IDENTIFICATION_RELEASER` |                                                                                                                           | Yes      |
| `REGISTRY_NPM_TOKEN`             | NPM registry authentication token for publishing packages. Required if enable-packages-registry-npm is true.              | No       |
| `REGISTRY_DOCKERHUB_TOKEN`       | DockerHub registry authentication token for publishing Docker images. Required if enable-apps-registry-dockerhub is true. | No       |

## Outputs
