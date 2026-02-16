# polyglot-monorepo-stack

Automate building, validation, and deployment for polyglot monorepos with an opinionated Yarn + Turborepo setup supporting multiple languages.

This workflow provides a complete CI/CD pipeline for polyglot monorepos, handling:

- Dependency validation and build checks
- Package publishing (for Node.js packages)
- Image builds for deployable apps

## Makefile Requirements

**This workflow requires a `Makefile`** with specific targets for dependency installation. This allows each repository to define its own installation strategy for multi-language setups.

### Required Targets

| Target              | Purpose                          | CI Usage          |
| ------------------- | -------------------------------- | ----------------- |
| `install`           | Install dependencies (dev)       | Local development |
| `install-immutable` | Install with lockfile validation | CI/CD             |

### Example: Node.js Only

```makefile
.PHONY: install install-immutable

install:
	yarn install

install-immutable:
	yarn install --immutable
```

### Example: Node.js + Python

```makefile
.PHONY: install install-immutable

install:
	yarn install
	uv sync

install-immutable:
	yarn install --immutable
	uv sync --frozen
```

### Example: Node.js + Python + Go

```makefile
.PHONY: install install-immutable

install:
	yarn install
	uv sync
	go mod download

install-immutable:
	yarn install --immutable
	uv sync --frozen
	go mod download && go mod verify
```

## Monorepo Requirements

Your repository must follow this structure:

### Package Manager & Build System

- **Yarn (Berry)** - Package manager with workspaces support
- **Turborepo** - Build system for monorepo orchestration and caching
- **`.tool-versions`** - asdf version file (supports `nodejs`, `python`, `golang`, etc.)
- **`Makefile`** - With `install` and `install-immutable` targets

### Directory Structure

```
your-repo/
├── Makefile              # Required: install and install-immutable targets
├── .tool-versions        # Required: tool versions for setup-tools
├── packages/             # Publishable packages (libraries, shared code)
│   ├── package-a/        # Node.js package
│   │   └── package.json
│   ├── package-b/        # Python package (with package.json for monorepo integration)
│   │   └── package.json
│   └── package-c/        # Go package (with package.json for monorepo integration)
│       └── package.json
└── apps/                 # Deployable applications (Docker images)
    ├── api/
    │   ├── package.json
    │   └── Dockerfile    # Required for Docker build
    └── worker/
        ├── package.json
        └── Dockerfile
```

**Validation Rules:**

- **Packages**: Must contain a `package.json` file
- **Apps**: Must contain both a `package.json` AND a `Dockerfile` to be considered valid for deployment
- **Private packages**: Packages with `"private": true` in package.json will not be published

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

## Package Language Tagging

Packages declare their language in `package.json` under `publishConfig.language`. This determines whether the package is eligible for npm publishing.

### Configuration

```json
{
  "name": "@your-org/my-package",
  "version": "1.0.0",
  "publishConfig": {
    "language": "nodejs",
    "npm": true,
    "ghpr": true
  }
}
```

### Supported Languages

| Language      | Value      | npm Publishing                      |
| ------------- | ---------- | ----------------------------------- |
| Node.js       | `"nodejs"` | Yes (if configured)                 |
| Python        | `"python"` | No (package.json for monorepo only) |
| Go            | `"golang"` | No (package.json for monorepo only) |
| Other         | Any string | No                                  |
| Not specified | (missing)  | Yes (defaults to `"nodejs"`)        |

### Why package.json for non-Node packages?

Even Python/Go packages have a `package.json` to:

- Integrate with Yarn/Turbo monorepo tooling
- Define scripts (`build`, `test`, etc.)
- Track version for release-please
- Participate in workspace dependency graph

### Example: Python Package

```json
{
  "name": "@your-org/python-lib",
  "version": "1.0.0",
  "private": false,
  "publishConfig": {
    "language": "python"
  },
  "scripts": {
    "build": "uv build",
    "test": "pytest"
  }
}
```

### Example: Go Package

```json
{
  "name": "@your-org/go-service",
  "version": "1.0.0",
  "private": false,
  "publishConfig": {
    "language": "golang"
  },
  "scripts": {
    "build": "go build ./...",
    "test": "go test ./..."
  }
}
```

## Package Publishing Configuration

Node.js packages are published based on their `publishConfig` in `package.json`. The workflow reads these flags to determine which registries to publish to.

### publishConfig Options

```json
{
  "name": "@your-org/package-name",
  "version": "1.0.0",
  "private": false,
  "publishConfig": {
    "language": "nodejs",
    "npm": true,
    "ghpr": true,
    "npmAccess": "public"
  }
}
```

**Available fields:**

- **`language`** (string) - Package language: `"nodejs"`, `"python"`, `"golang"`, etc. (default: `"nodejs"`)
- **`npm`** (boolean) - Publish to NPM registry (requires `enable-packages-registry-npm`)
- **`ghpr`** (boolean) - Publish to GitHub Package Registry (requires `enable-packages-registry-ghpr`, uses `GITHUB_TOKEN`)
- **`npmAccess`** (string) - Access level for NPM: `"public"` or `"restricted"` (default: `"public"`)

**Important:**

- Packages with `"private": true` are never published, regardless of `publishConfig`
- Only packages with `"language": "nodejs"` (or no language specified) are eligible for npm publishing
- GitHub Package Registry (ghpr) requires a scoped package name (e.g., `@your-org/package-name`)
- Both workflow-level inputs AND package-level `publishConfig` must be enabled for publishing to occur

## Docker Build Details

**Automatic Turbo Prune:**

- The workflow runs `turbo prune --docker` before building images
- Creates optimized structure in `out/{app-name}/` with `json/` (package files) and `full/` (source)
- Requires Turbo in root `package.json` and package `name` field in each app's `package.json`

**Available Build Arguments:**

- `app_name` - Application name from directory
- `node_version` - Node.js version from `.tool-versions` (required)
- `python_version` - Python version from `.tool-versions` (optional)
- `golang_version` - Go version from `.tool-versions` (optional)
- `uv_version` - UV version from `.tool-versions` (optional)
- `build_version` - Semantic version with commit (e.g., `v1.2.3-abc1234`)
- `build_commit` - Full commit SHA

**Example Dockerfile using multiple language versions:**

```dockerfile
ARG node_version
ARG python_version
ARG uv_version

FROM node:${node_version}-alpine AS node-builder
# ... Node.js build steps

FROM python:${python_version}-slim AS python-builder
# Install UV if version provided
ARG uv_version
RUN if [ -n "$uv_version" ]; then pip install uv==${uv_version}; fi
# ... Python build steps
```

**App-Specific Secrets:**

- Apps can have build-time secrets via the `APP_IMAGE_SECRETS` GitHub secret
- Use CSV format with structure: `app-name,secret-name,secret-value` (one per line)
- Example:
  ```
  api,NPM_TOKEN,npm_abc123xyz
  api,SENTRY_TOKEN,abc123
  frontend,API_KEY,secret-value
  ```
- Each secret is available as an individual BuildKit secret mount in your Dockerfile
- Access secrets using: `--mount=type=secret,id=SECRET_NAME`
- Secrets are mounted at `/run/secrets/SECRET_NAME` and are not stored in image layers
- **Example Dockerfile usage:**
  ```dockerfile
  RUN --mount=type=secret,id=NPM_TOKEN \
      npm config set //registry.npmjs.org/:_authToken $(cat /run/secrets/NPM_TOKEN)
  ```

## Migration from node-monorepo-stack

To migrate from `node-monorepo-stack` to `polyglot-monorepo-stack`:

1. **Create a Makefile** in your repository root:

   ```makefile
   .PHONY: install install-immutable

   install:
   	yarn install

   install-immutable:
   	yarn install --immutable
   ```

2. **Update your workflow reference**:

   ```yaml
   # Before
   uses: abinnovision/actions/.github/workflows/workflow.yaml@node-monorepo-stack-v1

   # After
   uses: abinnovision/actions/.github/workflows/workflow.yaml@polyglot-monorepo-stack-v1
   ```

3. **(Optional) Tag packages with languages** if you have non-Node.js packages:
   ```json
   {
     "publishConfig": {
       "language": "python"
     }
   }
   ```

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  polyglot-monorepo-stack:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@polyglot-monorepo-stack-v1
    secrets:
      GH_APP_IDENTIFICATION_RELEASER: ${{ secrets.GH_APP_IDENTIFICATION_RELEASER }}
    # Or to inherit the secrets from the caller:
    secrets: inherit
```

[//]: # "x-release-please-end"

## Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@polyglot-monorepo-stack-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@polyglot-monorepo-stack-v1.0.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Required | Default            |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------------- |
| `default-branch`                 | Default branch name for the repository.<br>**Default:** `main`<br>**Example:** `main`, `master`, `develop`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | No       | `main`             |
| `test-types`                     | Comma-separated list of test types to run.<br>**Valid values:** `unit`, `integration`, `e2e`<br>**Default:** `unit`<br>**Example:** `unit,integration,e2e`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | No       | `unit`             |
| `run-unit-tests-in-build`        | Run unit tests as part of the build step instead of a separate job.<br>Recommended for smaller monorepos to reduce overall execution time.<br>**Default:** `true`<br>**Note:** You must include `unit` in the `test-types` input for this to have any effect.                                                                                                                                                                                                                                                                                                                                                                                                                                 | No       | `true`             |
| `run-build-before-check`         | Run the build step before the check step in the check_build job.<br>Useful for monorepos where eslint/prettier/etc config packages must be built before linters can run.<br>**Default:** `false`<br>**Note:** When enabled, the build order becomes: Install → Dependencies Check → Build → Check → Unit Tests                                                                                                                                                                                                                                                                                                                                                                                | No       | _empty_            |
| `enable-package-publishing`      | Enable publishing packages to configured registries.<br>**Default:** `false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | No       | _empty_            |
| `enable-packages-registry-npm`   | Enable publishing packages to NPM registry with provenance.<br>**Default:** `false`<br>**Authentication:** Uses GitHub OIDC (no token required).<br>**Requirements:** Package must be linked to this GitHub repository on npmjs.org.                                                                                                                                                                                                                                                                                                                                                                                                                                                          | No       | _empty_            |
| `enable-packages-registry-ghpr`  | Enable publishing packages to GitHub Package Registry.<br>**Default:** `false`<br>**Authentication:** Uses `GITHUB_TOKEN` (automatically available)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | _empty_            |
| `enable-app-image-builds`        | Enable building and publishing Docker images for apps.<br>**Default:** `false`<br>**Note:** At least one registry must be enabled (`ghcr`, `dockerhub`, or `gcpar`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | _empty_            |
| `enable-apps-registry-ghcr`      | Enable publishing Docker images to GitHub Container Registry (GHCR).<br>**Default:** `true` (automatically available in GitHub Actions)<br>**Authentication:** Uses `GITHUB_TOKEN` (automatically available)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | No       | `true`             |
| `enable-apps-registry-dockerhub` | Enable publishing Docker images to DockerHub.<br>**Default:** `false`<br>**Requires:** `REGISTRY_DOCKERHUB_TOKEN` secret and `registry-dockerhub-username` input                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | No       | _empty_            |
| `registry-dockerhub-username`    | DockerHub username for authentication.<br>**Required:** When `enable-apps-registry-dockerhub` is enabled<br>**Example:** `myusername`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | No       | _empty_            |
| `registry-dockerhub-url`         | DockerHub registry URL.<br>**Default:** `docker.io`<br>**Example:** `docker.io`, `registry.hub.docker.com`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | No       | `docker.io`        |
| `enable-apps-registry-gcpar`     | Enable publishing Docker images to GCP Artifact Registry.<br>**Default:** `false`<br>**Requires:** `registry-gcpar-url` and `gcp-auth` inputs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No       | _empty_            |
| `registry-gcpar-url`             | GCP Artifact Registry URL for Docker images.<br>**Required:** When `enable-apps-registry-gcpar` is enabled<br>**Example:** `europe-west4-docker.pkg.dev/project-id/repository-name`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | _empty_            |
| `gcp-auth`                       | GCP authentication configuration (Workload Identity Federation).<br>This is public configuration, not a secret.<br>**Required:** When `enable-apps-registry-gcpar` is enabled<br>**Note:** Can be reused for other GCP services in the workflow<br>**Example:** `projects/123456789/locations/global/workloadIdentityPools/pool-id/providers/provider-id`                                                                                                                                                                                                                                                                                                                                     | No       | _empty_            |
| `gitops-workflow-file`           | GitOps workflow file to dispatch for deployment updates.<br>**Default:** `update-tags.yaml`<br>**Example:** `update-tags.yaml`, `deploy.yaml`<br>**Note:** Only used when `gitops-app-config` is provided                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | No       | `update-tags.yaml` |
| `gitops-app-config`              | Per-app GitOps configuration in **CSV format** (one per line).<br>**Format:** `app-name,target-repo,dev-application,release-application,registry,image-name`<br>**Example:**<br>`my-api,my-gitops-repo,my-api-dev,my-api-prod,ghcr,app-my-api`<br>`my-worker,my-gitops-repo,worker-dev,worker-prod,gcpar,app-my-worker`<br>**Registry options:** `ghcr`, `gcpar`, `dockerhub`<br>**Deployment tags:** Dev deployments use `sha-*` tags, release deployments use semver `v*.*.*` tags<br>**Note:** Only first 5 commas are delimiters; remaining fields can contain commas<br>**Important:** All fields are required. GitOps deployment will be skipped for apps with incomplete configuration | No       | _empty_            |
| `checkout-submodules`            | Wether to checkout submodules.<br>**Default:** `false`<br>**Example:** `true`, `false`, `recursive`<br>**Note:** Use `recursive` to recursively checkout submodules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | `false`            |
| `prerelease-channel`             | Prerelease channel name (e.g., "beta", "canary", "rc").<br>When set, computes prerelease versions and publishes with corresponding dist-tags.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No       | _empty_            |

## Secrets

| Secret                           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Required |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `GH_APP_IDENTIFICATION_RELEASER` | GitHub App identification for the release workflow.<br>**Required:** Always                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Yes      |
| `REGISTRY_DOCKERHUB_TOKEN`       | DockerHub registry authentication token for publishing Docker images.<br>**Required:** When `enable-apps-registry-dockerhub` is enabled<br>**Example:** `dckr_pat_1a2b3c4d5e6f7g8h9i0j`                                                                                                                                                                                                                                                                                                                                                                                                      | No       |
| `APP_IMAGE_SECRETS`              | App-specific build secrets for Docker image builds in **CSV format** (one per line).<br>**Format:** `app-name,secret-name,secret-value`<br>**Example:**<br>`<br>my-api,NPM_TOKEN,npm_abc123xyz<br>my-api,API_KEY,secret_key_here<br>my-frontend,BUILD_KEY,value,with,commas,is,ok<br>`<br>**Note:** Only the first two commas are delimiters; the secret value can contain commas.<br><br>Each secret is passed to Docker BuildKit as an individual secret mount with its own ID.<br><br>**Usage in Dockerfile:** `--mount=type=secret,id=NPM_TOKEN` (available at `/run/secrets/NPM_TOKEN`) | No       |
| `GITOPS_PROXY_URL`               | GitHub Workflow Dispatch Proxy URL for triggering GitOps workflows.<br>**Required:** When `gitops-app-config` is provided<br>**Example:** `https://gwdp.example.com`                                                                                                                                                                                                                                                                                                                                                                                                                         | No       |
| `CHECKOUT_TOKEN`                 | Access token to use for checkout.<br>**Default:** `Github Token`<br>**Note:** PAT requires an expiration date.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | No       |

## Outputs

| Output             | Description                                                                                                                                                                                                       |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `releases-created` | Whether any stable releases were created ("true"/"false").                                                                                                                                                        |
| `versions`         | JSON object mapping released/prerelease package paths to version info.<br>Each entry: {version: "semver", tag: "docker-compatible", type: "release"\|"prerelease"}.<br>Empty object {} when nothing was released. |
