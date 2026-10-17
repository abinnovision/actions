# publish-oci

Builds and pushes container images from the source payload of a stack and optionally dispatches
GitOps tag updates. It never checks out the repository; each image is built from the extracted
source payload. The image build executes the repository's `Dockerfile` inside BuildKit, so
repository code runs here.

`releases` is the release list v2 of a stack, see
[Publishing](../../docs/stacks/README.md#publishing). This workflow builds the entries tagged
`source` from the source payload.

## Behavior

| Job              | Runs                                                  | Does                                                                                                          |
| :--------------- | :---------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| `Prepare`        | Once, unless `releases` is empty or `[]`              | Selects the entries tagged `source`, validates them and the configuration                                     |
| `Build: <id>`    | Once per selected entry                               | Extracts the payload, builds and pushes the image unless it exists, writes an image summary                   |
| `GitOps Updates` | When `gitops-routes` is set and no image build failed | Dispatches one `gitops-workflow-file` run per target repository and application, unless the run is superseded |

- Entries are selected by the `source` tag in `tags`; there are no path patterns
- `Prepare` fails when any entry, selected or not, has no `latest`, as in a list older than v2
- The payload is the artifact `payload-source`, or `payload-source-<releaseSha>` for a `catchUp`
  entry, with the file `source.tar`
- `image` is resolved per unit: `{id}` becomes the entry's `id`, `{path}` its `path`
  (e.g. `app-{id}` -> `app-backend`); other placeholders fail `Prepare`. The result is lowercased,
  as OCI repository names must be. A value without placeholders, such as `image: recaptcha-v3` for a
  single-package repository, names the image directly

## Conventions

- The Dockerfile is `<path>/Dockerfile`, relative to the payload root
- The build context is the payload root
- The turbo remote cache is enabled when the payload root contains `turbo.json`
- A unit without a Dockerfile gets no image (notice), unless it has a `gitops-routes` line, which
  fails its build

## Build arguments

| Build arg                                | Value                                                            |
| :--------------------------------------- | :--------------------------------------------------------------- |
| `app_name`                               | Entry `id`                                                       |
| `node_version`                           | `nodejs` version from `.tool-versions`, empty when absent        |
| `python_version`                         | `python` version from `.tool-versions`, empty when absent        |
| `golang_version`                         | `golang` version from `.tool-versions`, empty when absent        |
| `uv_version`                             | `uv` version from `.tool-versions`, empty when absent            |
| `<tool>_version`                         | Every other tool listed in `.tool-versions`                      |
| `build_version`                          | `v<version>+` followed by the first 7 characters of `releaseSha` |
| `build_commit`                           | The first 7 characters of `releaseSha`                           |
| `TURBO_API`, `TURBO_TEAM`, `TURBO_TOKEN` | Only with the turbo remote cache enabled                         |

`.tool-versions` is read from the payload root.

## Images and tags

| Registry                  | Image                     |
| :------------------------ | :------------------------ |
| GCP Artifact Registry     | `<registry>/<image>`      |
| GitHub Container Registry | `ghcr.io/<owner>/<image>` |

Tags: `sha-` followed by the first 7 characters of `releaseSha`, `<version>` (semver) and
`release-<version>` for `kind: release` or `prerelease-<version>` for `kind: prerelease`, plus
`latest` as described in [Latest and dispatch](#latest-and-dispatch). Images get SBOM attestations.

## Latest and dispatch

Both follow the entry, as decided by tallyrelease:

| Entry                                    | `latest` tag | GitOps dispatch |
| :--------------------------------------- | :----------- | :-------------- |
| `latest: true`                           | Yes          | Yes             |
| `kind: prerelease` on the default branch | No           | Yes             |
| Any other entry                          | No           | No              |

- Releases on maintenance lines are never `latest`, and prereleases on maintenance branches are
  not dispatched. The default branch is `github.event.repository.default_branch` of the caller's run
- Re-run guard: on a run attempt after the first, each `Build: <id>` leg and `GitOps Updates` read
  the branch tip with the workflow `GITHUB_TOKEN` (`contents: read`), since "Re-run failed jobs"
  re-runs them without `Prepare`. When the tip is not the commit of the run, or reading it fails,
  no entry gets `latest` and nothing is dispatched (warning)
- Before building, each entry checks `<image>:<version>` in every configured registry. When all
  have it, build and push are skipped (`skipped (exists)` in the summary) and the leg succeeds; when
  only some have it, the image is built and pushed to all. A re-run therefore dispatches again under
  the rules above

## Caches

- **Registry layer cache:** with `registry` set, `<registry>/<image>-cache:latest` (`mode=max`)
- **Turbo remote cache:** with `turbo.json` in the payload root, a local cache server backed by the
  GitHub Actions cache runs on the runner. `TURBO_API`, `TURBO_TEAM` and `TURBO_TOKEN` are plain
  build args; declare them as `ARG` in the Dockerfile.

Per-app BuildKit secrets come from `APP_IMAGE_SECRETS`, see [Secrets](#secrets).

## GitOps updates

`gitops-routes` is CSV, one route per line:

```
id,type,target-repo,application[,image-name]
```

- `id` is the tallyrelease unit `id`, as is the first column of `APP_IMAGE_SECRETS`
- `type` is `release` for `kind: release` or `prerelease` for `kind: prerelease`
- Every line matching the unit and type of a dispatched entry is used, so one type can fan out to several
  applications and repositories; units or types without a line are not dispatched
- A unit with a line but without a Dockerfile fails its build, so nothing is dispatched
- `target-repo` without an owner is resolved against the repository owner
- `image-name` defaults to the resolved `image`; updates are `<image-name>:<version>`, batched per
  target repository and application
- Lines with fewer than 4 or more than 5 columns, empty columns or another `type` fail `Prepare`
- The dispatch token comes from the token broker (`token-broker-url` or `vars.TOKEN_BROKER_URL`)

## Migrating from v1

- The stack must emit the release list v2 (app-stack v2); a v1 list fails `Prepare`
- `include` is removed. Tag the units to build with `source` in `tallyrelease.yaml`
- `gcp-auth` is removed. Use `gcp-workload-identity-provider`
- `gitops-config` is removed. Each line `name,target-repo,dev-application,release-application[,image-name]`
  becomes the routes `id,prerelease,target-repo,dev-application[,image-name]` and
  `id,release,target-repo,release-application[,image-name]`
- `{name}` in `image` is replaced by `{id}`; the default is `{id}`
- The first column of `gitops-routes` and `APP_IMAGE_SECRETS` is the unit `id`
- Build legs are named `Build: <id>`

## Usage

This is a `workflow_call` workflow. Call it after the stack job that produced the release list.

[//]: # "x-release-please-start-major"

```yaml
jobs:
  publish-oci:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v2
    with:
      releases: ${{ <releases> }}
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v2`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v2.0.0`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

The calling job needs `id-token: write` (GCP and token broker), `packages: write` (GHCR),
`actions: write` (turbo cache) and `contents: read` (branch tip for the re-run guard).

[//]: # "x-release-please-start-major"

```yaml
jobs:
  ci:
    # ...stack call with outputs.releases

  publish-oci:
    name: Publish OCI
    needs: ci
    uses: abinnovision/actions/.github/workflows/workflow.yaml@publish-oci-v2
    permissions:
      contents: read
      id-token: write
      packages: write
      actions: write
    secrets: inherit
    with:
      releases: ${{ needs.ci.outputs.releases }}
      image: app-{id}
      registry: ${{ vars.FOUNDRY_REGISTRY_DOCKER }}
      gcp-workload-identity-provider: ${{ vars.FOUNDRY_WIF_PROVIDER }}
      gitops-routes: |
        backend,prerelease,my-gitops-dev,backend-dev
        backend,release,my-gitops-prod,backend-prod-eu
        backend,release,my-gitops-prod,backend-prod-us
        worker,release,my-gitops-prod,worker-prod,worker
```

[//]: # "x-release-please-end"

## Inputs

| Input                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Required | Default            |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------------- |
| `releases`                       | Release list v2 of a stack as a JSON array, the `releases` output of a stack.<br>This workflow builds the entries tagged `source` from the source payload.<br>An empty string, `[]` or a list without entries tagged `source` skips all work.<br>**Example:** `needs.ci.outputs.releases`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Yes      |                    |
| `image`                          | Image repository name, used for every registry. `{id}` (the unit `id`) and `{path}` are replaced per unit, and the result is lowercased. Other placeholders fail the run.<br>A value without placeholders is used as is for every unit.<br>**Default:** `{id}`<br>**Example:** `app-{id}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | No       | `{id}`             |
| `registry`                       | GCP Artifact Registry repository URL for the images.<br>**Default:** _empty_ (GCP Artifact Registry disabled)<br>**Requires:** `gcp-workload-identity-provider`<br>**Example:** `europe-docker.pkg.dev/project-id/repository-name`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | No       | _empty_            |
| `gcp-workload-identity-provider` | Full Workload Identity Federation provider resource name.<br>Authenticates directly as the repository without a service account.<br>This is public configuration, not a secret.<br>**Required:** When `registry` is set<br>**Example:** `projects/123456789/locations/global/workloadIdentityPools/pool-id/providers/provider-id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | No       | _empty_            |
| `ghcr`                           | Publish images to GitHub Container Registry (GHCR).<br>**Default:** `false`<br>**Authentication:** Uses `GITHUB_TOKEN` (automatically available)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | No       | _empty_            |
| `gitops-routes`                  | GitOps routes in **CSV format** (one per line).<br>**Format:** `unit-id,type,target-repo,application[,image-name]`, where `unit-id` is the tallyrelease unit `id`<br>**Type:** `release` for entries of kind `release`, `prerelease` for entries of kind `prerelease`<br>**Example:**<br>`my-api,prerelease,gitops-dev,my-api-dev`<br>`my-api,release,gitops-prod,my-api-prod-eu`<br>`my-api,release,gitops-prod,my-api-prod-us`<br>**Image name:** Defaults to the resolved `image` of the unit<br>**Deployment tags:** Every route uses the clean semver version as tag<br>**Note:** Every matching line is dispatched. Lines with fewer than 4 or more than 5 columns, empty columns or an unknown type fail the run. A unit with a line but without a Dockerfile fails its build. Units without a matching line are not dispatched | No       | _empty_            |
| `gitops-workflow-file`           | GitOps workflow file to dispatch for deployment updates.<br>**Default:** `update-tags.yaml`<br>**Example:** `update-tags.yaml`, `deploy.yaml`<br>**Note:** Only used when `gitops-routes` is provided                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | No       | `update-tags.yaml` |
| `token-broker-url`               | URL of the token broker for OIDC token exchange.<br>**Default:** Falls back to `vars.TOKEN_BROKER_URL` if not provided.<br>**Note:** Only used when `gitops-routes` is provided                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | No       | _empty_            |

## Secrets

| Secret              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Required |
| :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `APP_IMAGE_SECRETS` | App-specific build secrets for image builds in **CSV format** (one per line).<br>**Format:** `unit-id,secret-name,secret-value`, where `unit-id` is the tallyrelease unit `id`<br>**Example:**<br>`<br>my-api,NPM_TOKEN,npm_abc123xyz<br>my-api,API_KEY,secret_key_here<br>my-frontend,BUILD_KEY,value,with,commas,is,ok<br>`<br>**Note:** Only the first two commas are delimiters; the secret value can contain commas.<br><br>Each secret is passed to Docker BuildKit as an individual secret mount with its own ID.<br><br>**Usage in Dockerfile:** `--mount=type=secret,id=NPM_TOKEN` (available at `/run/secrets/NPM_TOKEN`) | No       |
