# publish-oci

Builds and pushes container images from a build context produced by a stack, and optionally
dispatches GitOps tag updates. It never checks out the repository: each image is built from the
extracted context tar of the payload artifact. The build executes the repository's `Dockerfile`
inside BuildKit, so repository code does run here; only `publish-npm` runs no repository code.

## Behavior

| Job              | Runs                                                    | Does                                                                            |
| :--------------- | :------------------------------------------------------ | :------------------------------------------------------------------------------ |
| `<name>`         | Once per release list entry, unless `releases` is empty | Extracts the context, builds and pushes the image, writes an image summary      |
| `GitOps Updates` | When `gitops-config` is set and every image was pushed  | Dispatches one `gitops-workflow-file` run per target repository and application |

- Skips all work when `releases` is empty or `[]`
- Validates every entry before building and fails on an unsupported `schema` or a missing `name`,
  `version`, `sha`, `artifact`, `file`, `oci.image` or `oci.file`
- Fails when neither `registry` nor `ghcr` is configured, or when a `gitops-config` line is malformed
- Images are built with SBOM attestations

## Release list

`releases` is a JSON array following the
[release list protocol](../../docs/stacks/README.md#release-list) (schema 1), the `oci` output of a
stack:

```json
[
  {
    "schema": 1,
    "name": "backend",
    "version": "1.4.0-beta.5",
    "channel": "beta",
    "sha": "a3f2c1d",
    "artifact": "oci-context",
    "file": "context.tar",
    "oci": {
      "image": "app-backend",
      "file": "apps/backend/Dockerfile",
      "context": ".",
      "build-args": { "app_name": "backend", "node_version": "24.20.0" },
      "turbo-cache": true
    }
  }
]
```

The artifact holds the build context tar named by `file`. It is extracted with `tar -xf`, so file
modes are kept.

| `oci` field   | Required | Meaning                                                                        |
| :------------ | :------- | :----------------------------------------------------------------------------- |
| `image`       | Yes      | Image repository name, used for every registry                                 |
| `file`        | Yes      | Dockerfile path relative to the context root                                   |
| `context`     | No       | Build context relative to the extracted tar root, default `.`                  |
| `build-args`  | No       | Object passed as Docker build args, one per key                                |
| `turbo-cache` | No       | Starts the turbo cache server and passes `TURBO_*` build args, default `false` |

## Images and tags

| Registry                  | Image                         |
| :------------------------ | :---------------------------- |
| GCP Artifact Registry     | `<registry>/<oci.image>`      |
| GitHub Container Registry | `ghcr.io/<owner>/<oci.image>` |

Every image gets these tags:

- `sha-<sha>`
- `<version>` (semver)
- `release-<version>` when `channel` is empty, `prerelease-<version>` otherwise, e.g. `release-1.4.0`
  or `prerelease-1.4.0-beta.5`

## Caches

- **Registry layer cache:** with `registry` set, layers are cached in `<registry>/<oci.image>-cache:latest`
  (`mode=max`)
- **Turbo remote cache:** with `oci.turbo-cache`, a local turbo cache server backed by the GitHub Actions
  cache is started on the runner. The builder runs with host networking, and `TURBO_API`, `TURBO_TEAM`
  and `TURBO_TOKEN` are passed as build args. Declare them as `ARG` in the Dockerfile to use the cache in
  `turbo` builds. These are plain build args, not BuildKit secrets.

## Build secrets

Per-app build-time secrets come from the `APP_IMAGE_SECRETS` secret, in CSV format, one per line:

```
backend,NPM_TOKEN,npm_abc123xyz
```

Each secret is a BuildKit secret mount, available at `/run/secrets/<name>`:

```dockerfile
RUN --mount=type=secret,id=NPM_TOKEN \
    npm config set //registry.npmjs.org/:_authToken $(cat /run/secrets/NPM_TOKEN)
```

## GitOps updates

`gitops-config` is CSV, one line per unit:

```
name,target-repo,dev-application,release-application[,image-name]
```

- `name` matches the entry's `name`; units without a line are skipped with a warning
- `target-repo` without an owner is resolved against the repository owner
- Stable releases (empty `channel`) deploy to `release-application`, prereleases to `dev-application`
- `image-name` defaults to the entry's `oci.image`
- Updates are `<image-name>:<version>`; units targeting the same repository and application are
  batched into one dispatch with comma-separated `updates`
- Lines with fewer than 4 or more than 5 columns, or with empty columns, fail the run before any
  image is built
- The dispatch token is exchanged at the token broker (`token-broker-url` or `vars.TOKEN_BROKER_URL`)
  with `contents:read actions:write` on the target repositories

## Usage

This is a `workflow_call` workflow, so it can't be triggered directly. Call it after the stack job
that produced the release list and artifact.

[//]: # "x-release-please-start-major"

```yaml
jobs:
  publish-oci:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v0
    with:
      releases: ${{ <releases> }}
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v0`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v0.0.0`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

The calling job needs `id-token: write` (GCP and token broker), `packages: write` (GHCR),
`actions: write` (turbo cache) and `contents: read`.

[//]: # "x-release-please-start-major"

```yaml
jobs:
  ci:
    # ...stack call with outputs.oci

  publish-oci:
    name: Publish OCI
    needs: ci
    # Publishes the successfully packed units even when the stack partially failed.
    if: ${{ !cancelled() }}
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v0
    permissions:
      contents: read
      id-token: write
      packages: write
      actions: write
    secrets: inherit
    with:
      releases: ${{ needs.ci.outputs.oci }}
      registry: ${{ vars.FOUNDRY_REGISTRY_DOCKER }}
      gcp-workload-identity-provider: ${{ vars.FOUNDRY_WIF_PROVIDER }}
```

[//]: # "x-release-please-end"

## Inputs

| Input                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Required | Default            |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------- | :----------------- |
| `releases`                       | Release list (schema 1) as a JSON array, the `oci` output of a stack.<br>Each entry carries an `oci` block and names the build context tar (`file`) inside the payload artifact (`artifact`).<br>An empty string or `[]` skips all work.<br>**Example:** `needs.ci.outputs.oci`                                                                                                                                                                                                                                                                               | Yes      |                    |
| `registry`                       | GCP Artifact Registry repository URL for the images.<br>**Default:** _empty_ (GCP Artifact Registry disabled)<br>**Requires:** `gcp-workload-identity-provider` or `gcp-auth`<br>**Example:** `europe-docker.pkg.dev/project-id/repository-name`                                                                                                                                                                                                                                                                                                              | No       | _empty_            |
| `gcp-workload-identity-provider` | Full Workload Identity Federation provider resource name.<br>Authenticates directly as the repository without a service account.<br>This is public configuration, not a secret.<br>**Required:** When `registry` is set, unless `gcp-auth` is set<br>**Note:** Mutually exclusive with `gcp-auth`<br>**Example:** `projects/123456789/locations/global/workloadIdentityPools/pool-id/providers/provider-id`                                                                                                                                                   | No       | _empty_            |
| `gcp-auth`                       | **Deprecated:** Use `gcp-workload-identity-provider`.<br>The `GCP_AUTH` variable, authenticating as a service account.<br>This is public configuration, not a secret.<br>**Note:** Mutually exclusive with `gcp-workload-identity-provider`                                                                                                                                                                                                                                                                                                                   | No       | _empty_            |
| `ghcr`                           | Publish images to GitHub Container Registry (GHCR).<br>**Default:** `false`<br>**Authentication:** Uses `GITHUB_TOKEN` (automatically available)                                                                                                                                                                                                                                                                                                                                                                                                              | No       | _empty_            |
| `gitops-config`                  | Per-unit GitOps configuration in **CSV format** (one per line).<br>**Format:** `name,target-repo,dev-application,release-application[,image-name]`<br>**Example:**<br>`my-api,my-gitops-repo,my-api-dev,my-api-prod`<br>`my-worker,my-gitops-repo,worker-dev,worker-prod,worker`<br>**Image name:** Defaults to the entry's `oci.image`<br>**Deployment tags:** Dev and release deployments use the clean semver version as tag<br>**Note:** Lines with fewer than 4 or more than 5 columns, or empty columns, fail the run. Units without a line are skipped | No       | _empty_            |
| `gitops-workflow-file`           | GitOps workflow file to dispatch for deployment updates.<br>**Default:** `update-tags.yaml`<br>**Example:** `update-tags.yaml`, `deploy.yaml`<br>**Note:** Only used when `gitops-config` is provided                                                                                                                                                                                                                                                                                                                                                         | No       | `update-tags.yaml` |
| `token-broker-url`               | URL of the token broker for OIDC token exchange.<br>**Default:** Falls back to `vars.TOKEN_BROKER_URL` if not provided.<br>**Note:** Only used when `gitops-config` is provided                                                                                                                                                                                                                                                                                                                                                                               | No       | _empty_            |

## Secrets

| Secret              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Required |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------- |
| `APP_IMAGE_SECRETS` | App-specific build secrets for image builds in **CSV format** (one per line).<br>**Format:** `app-name,secret-name,secret-value`<br>**Example:**<br>`<br>my-api,NPM_TOKEN,npm_abc123xyz<br>my-api,API_KEY,secret_key_here<br>my-frontend,BUILD_KEY,value,with,commas,is,ok<br>`<br>**Note:** Only the first two commas are delimiters; the secret value can contain commas.<br><br>Each secret is passed to Docker BuildKit as an individual secret mount with its own ID.<br><br>**Usage in Dockerfile:** `--mount=type=secret,id=NPM_TOKEN` (available at `/run/secrets/NPM_TOKEN`) | No       |
