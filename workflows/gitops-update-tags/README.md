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

This is a `workflow_call` workflow, so it can't be triggered directly. It must be called
from its own workflow file in the consuming repository, triggered by e.g.
`workflow_dispatch`.

[//]: # "x-release-please-start-major"

```yaml
jobs:
  gitops-update-tags:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1
    with:
      application: ${{ <application> }}
      updates: ${{ <updates> }}
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1.2.4`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

Complete, copyable caller workflow (e.g. `.github/workflows/update-tags.yaml`), triggered
manually and scoping automerge to the `staging` application:

[//]: # "x-release-please-start-major"

```yaml
name: Update Tags

on:
  workflow_dispatch:
    inputs:
      application:
        description: "Application directory to update, e.g. staging, production"
        required: true
      updates:
        description: "Image tag updates as CSV, e.g. app-backend:vX.X.X,app-frontend:vX.X.X"
        required: true

jobs:
  update:
    name: Update Tags
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1
    permissions:
      contents: read
      id-token: write
    with:
      application: ${{ github.event.inputs.application }}
      updates: ${{ github.event.inputs.updates }}
      # Auto-merge only for staging, once all listed images are updated
      automerge-images: ${{ github.event.inputs.application == 'staging' && 'app-backend,app-frontend' || '' }}
```

[//]: # "x-release-please-end"

## Advanced Configuration

### Automerge

Auto-merge PR when all specified images are updated:

```yaml
with:
  automerge-images: app-backend,app-frontend
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
| `updates`                | Image tag updates to apply, in CSV format (one entry per image).<br>Format: image-name:tag,image-name:tag,...<br>Example: app-backend:v1.4.2,app-frontend:v1.4.2                                                                                                                                                                                                                                                                   | Yes      |                    |
| `applications-directory` | Root directory containing application subdirectories.<br>**Default:** `k8s/applications`                                                                                                                                                                                                                                                                                                                                           | No       | `k8s/applications` |
| `default-branch`         | Default branch name for the repository.<br>**Default:** `main`                                                                                                                                                                                                                                                                                                                                                                     | No       | `main`             |
| `automerge-images`       | Comma-separated list of image names that must ALL be updated to enable automerge.<br>Leave empty to disable automerge for this application.<br><br>**Scoping to applications:** Control automerge per-application by passing this<br>input only for applications that should automerge (e.g., staging) and omitting<br>it for applications that require manual review (e.g., production).<br><br>**Example:** `backend,tma,portal` | No       | _empty_            |
