# gitops-update-tags

Automate image tag updates in GitOps repositories using kustomize.

This workflow provides automated image tag updates for ArgoCD-managed applications:

- **Tag Updates** - Updates image tags in kustomization.yaml files
- **PR Grouping** - Groups multiple tag updates in a single pull request
- **Validation** - Validates application and image names before updating
- **Auto-formatting** - Formats files after kustomize edits

## Repository Requirements

Your repository must follow this structure:

### Directory Structure

```
your-gitops-repo/
├── k8s/
│   └── applications/
│       ├── staging/
│       │   └── kustomization.yaml    # Contains images configuration
│       └── production/
│           └── kustomization.yaml
└── .github/
    └── workflows/
        └── update-tags.yaml          # Your workflow using this
```

### Kustomization Format

Your `kustomization.yaml` must include an `images` section:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

images:
  - name: image # Image identifier
    newName: ghcr.io/my-org/my-app
    newTag: v1.2.3

  - name: api-image # Another image
    newName: ghcr.io/my-org/my-api
    newTag: v1.0.0
```

The `name` field in the images array is the identifier used in the `image` input parameter.

## How It Works

### 1. Cherry-pick Pattern

The workflow groups multiple tag updates in a single PR:

1. First update creates a new branch and PR
2. Subsequent updates cherry-pick existing commits before adding new ones
3. Result: Single PR with all tag updates

**Example:**

```
10:00 - Update api-image to v1.2.3
        → Creates branch: fix/tag-update/staging
        → Creates PR with 1 commit

10:05 - Update worker-image to v1.2.4
        → Cherry-picks api-image commit
        → Adds worker-image commit
        → Updates same PR (now 2 commits)

10:10 - PR merged with both updates
```

### 2. Tag Update Process

1. Validates application directory exists
2. Validates image name exists in kustomization.yaml
3. Uses `kustomize edit set image` to update tag
4. Formats files with prettier
5. Creates/updates pull request

### 3. Kustomize Edit Command

The workflow runs:

```bash
kustomize edit set image <image-name>=*:<new-tag>
```

This updates the `newTag` field for the specified image in `kustomization.yaml`.

## Integration Examples

### Trigger from Docker Build Workflow

After building and pushing a Docker image, trigger this workflow to update GitOps:

```yaml
- name: Trigger GitOps Update
  uses: peter-evans/repository-dispatch@v3
  with:
    token: $
    repository: my-org/my-gitops-repo
    event-type: update-tags
    client-payload: |
      {
        "application": "staging",
        "tag": "v$",
        "image": "api-image"
      }
```

### Workflow Dispatch API

Trigger via GitHub API:

```bash
curl -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/my-org/my-gitops-repo/actions/workflows/update-tags.yaml/dispatches \
  -d '{
    "ref": "main",
    "inputs": {
      "application": "staging",
      "tag": "v1.2.3",
      "image": "api-image"
    }
  }'
```

### Multiple Images

Update multiple images in sequence:

```yaml
jobs:
  update-api:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1
    with:
      application: staging
      tag: v1.2.3
      image: api-image

  update-worker:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1
    with:
      application: staging
      tag: v1.2.4
      image: worker-image
```

Both updates will be grouped in the same PR automatically.

## Advanced Configuration

### Using GCP Authentication

If you need GCP authentication to access resources during the workflow:

```yaml
with:
  use-gcp-auth: true
secrets:
  GCP_AUTH: $
```

### Custom Applications Directory

```yaml
with:
  applications-directory: manifests/apps
```

### Custom Branch Name

The workflow uses the branch pattern: `fix/tag-update/<application>`

For application "staging", the branch will be: `fix/tag-update/staging`

## Troubleshooting

### Image Not Found Error

**Problem:** `Image 'my-image' not found in kustomization.yaml`

**Solution:**

1. Check the `images` array in your `kustomization.yaml`
2. Ensure the `name` field matches your `image` input parameter
3. The `name` is an identifier, not the full image path

### Application Directory Not Found

**Problem:** `Application directory not found: k8s/applications/staging`

**Solution:**

1. Verify the application directory exists
2. Check `applications-directory` input matches your repo structure
3. Ensure the `application` input parameter is correct

### Cherry-pick Conflicts

**Problem:** Cherry-pick fails when updating existing PR

**Solution:**

The workflow will automatically skip failed cherry-picks and continue. If this happens frequently:

1. Merge PRs more frequently
2. Don't make manual changes to update branches
3. Let the automated workflow manage the branches

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

## Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1.0`: Targeting minor version <!-- x-release-please-minor -->
- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1.0.0`: Targeting a patch version <!-- x-release-please-version -->

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

## Outputs
