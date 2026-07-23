# gitops-update-tags

Updates image tags in kustomization files and creates pull requests.

> For repository setup, see [GitOps Stack documentation](../../docs/gitops-stack/README.md).

## Behavior

- Updates `kustomization.yaml` using `kustomize edit set image`
- Groups multiple updates into single PR per application
- Formats files with prettier before committing
- Optional automerge when all specified images are updated
- Writes a job summary with the applied `image -> tag` updates, the pull request link, and automerge status

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  gitops-update-tags:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1
    with:
      application: ${{ <application> }}
      tag: ${{ <tag> }}
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1.3.0`: Targeting a patch version <!-- x-release-please-version -->

## Advanced Configuration

### Automerge

Auto-merge PR when all specified images are updated:

```yaml
with:
  automerge-images: app-backend,app-frontend,app-worker
```

### Custom Applications Directory

```yaml
with:
  applications-directory: manifests/apps
```

## Inputs

| Input                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                        | Required | Default            |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------------- |
| `token-broker-url`       | URL of the token broker for OIDC token exchange.<br>**Default:** Falls back to `vars.TOKEN_BROKER_URL` if not provided.                                                                                                                                                                                                                                                                                                            | No       | _empty_            |
| `application`            | Application directory name to update.<br>**Required:** Always<br>**Example:** `staging`, `production`, `my-app`                                                                                                                                                                                                                                                                                                                    | Yes      |                    |
| `tag`                    | The image tag to update to.<br>**Required:** Always<br>**Example:** `v1.2.3`, `sha-abc123`, `latest`                                                                                                                                                                                                                                                                                                                               | Yes      |                    |
| `image`                  | Name of the image to update (must exist in kustomization.yaml).<br>**Example:** `image`, `api-image`, `worker-image`                                                                                                                                                                                                                                                                                                               | No       | `image`            |
| `applications-directory` | Root directory containing application subdirectories.<br>**Default:** `k8s/applications`                                                                                                                                                                                                                                                                                                                                           | No       | `k8s/applications` |
| `default-branch`         | Default branch name for the repository.<br>**Default:** `main`                                                                                                                                                                                                                                                                                                                                                                     | No       | `main`             |
| `automerge-images`       | Comma-separated list of image names that must ALL be updated to enable automerge.<br>Leave empty to disable automerge for this application.<br><br>**Scoping to applications:** Control automerge per-application by passing this<br>input only for applications that should automerge (e.g., staging) and omitting<br>it for applications that require manual review (e.g., production).<br><br>**Example:** `backend,tma,portal` | No       | _empty_            |
