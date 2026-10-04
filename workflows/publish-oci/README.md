# publish-oci

Builds and pushes container images from the source payload of a stack and optionally dispatches
GitOps tag updates. It never checks out the repository; each image is built from the extracted
source payload. The image build executes the repository's `Dockerfile` inside BuildKit, so
repository code runs here.

`releases` is the release list of a stack, see
[Publishing](../../docs/stacks/README.md#publishing). This workflow consumes `payloads.source` of
the entries whose `path` matches `include`.

## Behavior

| Job              | Runs                                                  | Does                                                                            |
| :--------------- | :---------------------------------------------------- | :------------------------------------------------------------------------------ |
| `Prepare`        | Once, unless `releases` is empty or `[]`              | Selects the entries matching `include`, validates them and the configuration    |
| `<name>`         | Once per selected entry                               | Extracts the payload, builds and pushes the image, writes an image summary      |
| `GitOps Updates` | When `gitops-config` is set and no image build failed | Dispatches one `gitops-workflow-file` run per target repository and application |

- `include` holds directory patterns, one per line; `*` matches exactly one path segment
  (default `apps/*`)
- `Prepare` fails when a selected entry has a `schema` other than `1` or no `payloads.source`
- `image` is resolved per unit by plain string replacement: `{path}` becomes the entry's `path`,
  `{name}` its `name` (e.g. `app-{name}` -> `app-backend`). The result is lowercased, as OCI
  repository names must be. A value without placeholders, such as `image: recaptcha-v3` for a
  single-package repository, names the image directly

## Conventions

- The Dockerfile is `<path>/Dockerfile`, relative to the payload root
- The build context is the payload root
- The turbo remote cache is enabled when the payload root contains `turbo.json`
- A unit without a Dockerfile gets no image (notice), unless it has a `gitops-config` line, which
  fails its build

## Build arguments

| Build arg                                | Value                                                     |
| :--------------------------------------- | :-------------------------------------------------------- |
| `app_name`                               | Entry `name`                                              |
| `node_version`                           | `nodejs` version from `.tool-versions`, empty when absent |
| `python_version`                         | `python` version from `.tool-versions`, empty when absent |
| `golang_version`                         | `golang` version from `.tool-versions`, empty when absent |
| `uv_version`                             | `uv` version from `.tool-versions`, empty when absent     |
| `<tool>_version`                         | Every other tool listed in `.tool-versions`               |
| `build_version`                          | `v<version>+<sha>`                                        |
| `build_commit`                           | `<sha>`                                                   |
| `TURBO_API`, `TURBO_TEAM`, `TURBO_TOKEN` | Only with the turbo remote cache enabled                  |

`.tool-versions` is read from the payload root.

## Images and tags

| Registry                  | Image                     |
| :------------------------ | :------------------------ |
| GCP Artifact Registry     | `<registry>/<image>`      |
| GitHub Container Registry | `ghcr.io/<owner>/<image>` |

Tags: `sha-<sha>`, `<version>` (semver) and `release-<version>` for a stable release (empty
`channel`) or `prerelease-<version>` otherwise. Images get SBOM attestations.

## Caches

- **Registry layer cache:** with `registry` set, `<registry>/<image>-cache:latest` (`mode=max`)
- **Turbo remote cache:** with `turbo.json` in the payload root, a local cache server backed by the
  GitHub Actions cache runs on the runner. `TURBO_API`, `TURBO_TEAM` and `TURBO_TOKEN` are plain
  build args; declare them as `ARG` in the Dockerfile.

Per-app BuildKit secrets come from `APP_IMAGE_SECRETS`, see [Secrets](#secrets).

## GitOps updates

`gitops-config` is CSV, one line per unit:

```
name,target-repo,dev-application,release-application[,image-name]
```

- Units without a line are not dispatched; a unit with a line but without a Dockerfile fails its
  build, so nothing is dispatched
- `target-repo` without an owner is resolved against the repository owner
- Stable releases deploy to `release-application`, prereleases to `dev-application`
- `image-name` defaults to the resolved `image`; updates are `<image-name>:<version>`, batched per
  target repository and application
- Lines with fewer than 4 or more than 5 columns, or with empty columns, fail `Prepare`
- The dispatch token comes from the token broker (`token-broker-url` or `vars.TOKEN_BROKER_URL`)

## Usage

This is a `workflow_call` workflow. Call it after the stack job that produced the release list.

[//]: # "x-release-please-start-major"

```yaml
jobs:
  publish-oci:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v1
    with:
      releases: ${{ <releases> }}
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v1.0.1`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

The calling job needs `id-token: write` (GCP and token broker), `packages: write` (GHCR),
`actions: write` (turbo cache) and `contents: read`.

[//]: # "x-release-please-start-major"

```yaml
jobs:
  ci:
    # ...stack call with outputs.releases

  publish-oci:
    name: Publish OCI
    needs: ci
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v1
    permissions:
      contents: read
      id-token: write
      packages: write
      actions: write
    secrets: inherit
    with:
      releases: ${{ needs.ci.outputs.releases }}
      image: app-{name}
      registry: ${{ vars.FOUNDRY_REGISTRY_DOCKER }}
      gcp-workload-identity-provider: ${{ vars.FOUNDRY_WIF_PROVIDER }}
      gitops-config: |
        backend,my-gitops-repo,backend-dev,backend-prod
        worker,my-gitops-repo,worker-dev,worker-prod,worker
```

[//]: # "x-release-please-end"

## Inputs

| Input                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Required | Default            |
| :------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------------- |
| `releases`                       | Release list (schema 1) of a stack as a JSON array, the `releases` output of a stack.<br>This workflow builds the entries whose `path` matches `include` from their `payloads.source`.<br>An empty string, `[]` or a list without matching entries skips all work.<br>**Example:** `needs.ci.outputs.releases`                                                                                                                                                                                                                                                                                                                             | Yes      |                    |
| `include`                        | Directory patterns selecting the entries by `path`, one per line. `*` matches exactly one path segment.<br>**Default:** `apps/*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | `apps/*`           |
| `image`                          | Image repository name, used for every registry. `{path}` and `{name}` are replaced per unit, and the result is lowercased.<br>A value without placeholders is used as is for every unit.<br>**Default:** `{name}`<br>**Example:** `app-{name}`                                                                                                                                                                                                                                                                                                                                                                                             | No       | `{name}`           |
| `registry`                       | GCP Artifact Registry repository URL for the images.<br>**Default:** _empty_ (GCP Artifact Registry disabled)<br>**Requires:** `gcp-workload-identity-provider` or `gcp-auth`<br>**Example:** `europe-docker.pkg.dev/project-id/repository-name`                                                                                                                                                                                                                                                                                                                                                                                           | No       | _empty_            |
| `gcp-workload-identity-provider` | Full Workload Identity Federation provider resource name.<br>Authenticates directly as the repository without a service account.<br>This is public configuration, not a secret.<br>**Required:** When `registry` is set, unless `gcp-auth` is set<br>**Note:** Mutually exclusive with `gcp-auth`<br>**Example:** `projects/123456789/locations/global/workloadIdentityPools/pool-id/providers/provider-id`                                                                                                                                                                                                                                | No       | _empty_            |
| `gcp-auth`                       | **Deprecated:** Use `gcp-workload-identity-provider`.<br>The `GCP_AUTH` variable, authenticating as a service account.<br>This is public configuration, not a secret.<br>**Note:** Mutually exclusive with `gcp-workload-identity-provider`                                                                                                                                                                                                                                                                                                                                                                                                | No       | _empty_            |
| `ghcr`                           | Publish images to GitHub Container Registry (GHCR).<br>**Default:** `false`<br>**Authentication:** Uses `GITHUB_TOKEN` (automatically available)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No       | _empty_            |
| `gitops-config`                  | Per-unit GitOps configuration in **CSV format** (one per line).<br>**Format:** `name,target-repo,dev-application,release-application[,image-name]`<br>**Example:**<br>`my-api,my-gitops-repo,my-api-dev,my-api-prod`<br>`my-worker,my-gitops-repo,worker-dev,worker-prod,worker`<br>**Image name:** Defaults to the resolved `image` of the unit<br>**Deployment tags:** Dev and release deployments use the clean semver version as tag<br>**Note:** Lines with fewer than 4 or more than 5 columns, or empty columns, fail the run. A unit with a line but without a Dockerfile fails its build. Units without a line are not dispatched | No       | _empty_            |
| `gitops-workflow-file`           | GitOps workflow file to dispatch for deployment updates.<br>**Default:** `update-tags.yaml`<br>**Example:** `update-tags.yaml`, `deploy.yaml`<br>**Note:** Only used when `gitops-config` is provided                                                                                                                                                                                                                                                                                                                                                                                                                                      | No       | `update-tags.yaml` |
| `token-broker-url`               | URL of the token broker for OIDC token exchange.<br>**Default:** Falls back to `vars.TOKEN_BROKER_URL` if not provided.<br>**Note:** Only used when `gitops-config` is provided                                                                                                                                                                                                                                                                                                                                                                                                                                                            | No       | _empty_            |

## Secrets

| Secret              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Required |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------- |
| `APP_IMAGE_SECRETS` | App-specific build secrets for image builds in **CSV format** (one per line).<br>**Format:** `app-name,secret-name,secret-value`<br>**Example:**<br>`<br>my-api,NPM_TOKEN,npm_abc123xyz<br>my-api,API_KEY,secret_key_here<br>my-frontend,BUILD_KEY,value,with,commas,is,ok<br>`<br>**Note:** Only the first two commas are delimiters; the secret value can contain commas.<br><br>Each secret is passed to Docker BuildKit as an individual secret mount with its own ID.<br><br>**Usage in Dockerfile:** `--mount=type=secret,id=NPM_TOKEN` (available at `/run/secrets/NPM_TOKEN`) | No       |
