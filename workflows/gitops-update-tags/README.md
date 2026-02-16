# gitops-update-tags

Updates image tags in kustomization files and creates pull requests.

> For repository setup, see [GitOps Stack documentation](../../docs/gitops-stack/README.md).

## Behavior

- Updates `kustomization.yaml` using `kustomize edit set image`
- Groups multiple updates into single PR per application
- Formats files with prettier before committing
- Optional automerge when all specified images are updated

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  gitops-update-tags:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1
    secrets:
      GH_APP_IDENTIFICATION_RELEASER: ${{ secrets.GH_APP_IDENTIFICATION_RELEASER }}
    # Or to inherit the secrets from the caller:
    secrets: inherit
    with:
      application: ${{ <application> }}
      tag: ${{ <tag> }}
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1.1.1`: Targeting a patch version <!-- x-release-please-version -->

## Advanced Configuration

### Automerge

Auto-merge PR when all specified images are updated:

```yaml
with:
  automerge-images: app-backend,app-frontend,app-worker
```

### GCP Authentication

```yaml
with:
  use-gcp-auth: true
secrets:
  GCP_AUTH: ${{ vars.GCP_AUTH }}
```

### Custom Applications Directory

```yaml
with:
  applications-directory: manifests/apps
```

## Inputs

| Input                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                        | Required | Default            |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------------- |
| `application`            | Application directory name to update.<br>**Required:** Always<br>**Example:** `staging`, `production`, `my-app`                                                                                                                                                                                                                                                                                                                    | Yes      |                    |
| `tag`                    | The image tag to update to.<br>**Required:** Always<br>**Example:** `v1.2.3`, `sha-abc123`, `latest`                                                                                                                                                                                                                                                                                                                               | Yes      |                    |
| `image`                  | Name of the image to update (must exist in kustomization.yaml).<br>**Example:** `image`, `api-image`, `worker-image`                                                                                                                                                                                                                                                                                                               | No       | `image`            |
| `applications-directory` | Root directory containing application subdirectories.<br>**Default:** `k8s/applications`                                                                                                                                                                                                                                                                                                                                           | No       | `k8s/applications` |
| `default-branch`         | Default branch name for the repository.<br>**Default:** `main`                                                                                                                                                                                                                                                                                                                                                                     | No       | `main`             |
| `use-gcp-auth`           | Whether to setup GCP authentication.<br>**Default:** `false`                                                                                                                                                                                                                                                                                                                                                                       | No       | _empty_            |
| `automerge-images`       | Comma-separated list of image names that must ALL be updated to enable automerge.<br>Leave empty to disable automerge for this application.<br><br>**Scoping to applications:** Control automerge per-application by passing this<br>input only for applications that should automerge (e.g., staging) and omitting<br>it for applications that require manual review (e.g., production).<br><br>**Example:** `backend,tma,portal` | No       | _empty_            |

## Secrets

| Secret                           | Description                                                                                                    | Required |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------- | :------- |
| `GH_APP_IDENTIFICATION_RELEASER` | GitHub App identification for creating PRs.<br>**Required:** Always                                            | Yes      |
| `GCP_AUTH`                       | GCP authentication configuration (if needed for accessing resources).<br>**Required:** When using GCP services | No       |
