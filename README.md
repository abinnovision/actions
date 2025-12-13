# gitops-deploy

Automate ArgoCD application validation, diff previews, and deployments for GitOps repositories.

This workflow provides a complete CI/CD pipeline for ArgoCD-managed infrastructure repositories, handling:

- **Application Discovery** - Automatically discovers applications using `.argocd-app` marker files
- **Validation** - Validates Kubernetes manifests using kustomize, kubeconform, and kube-score
- **PR Preview** - Shows diffs of ArgoCD applications in pull requests
- **Automated Deployment** - Syncs ArgoCD applications when changes are merged to main

## Repository Requirements

Your repository must follow this structure:

### Directory Structure

```
your-gitops-repo/
├── k8s/
│   └── applications/           # Applications directory (configurable)
│       ├── default/
│       │   ├── .argocd-app    # Marker file containing ArgoCD app name
│       │   ├── kustomization.yaml
│       │   └── apps/
│       │       ├── app1.yaml
│       │       └── app2.yaml
│       └── staging/
│           ├── .argocd-app
│           ├── kustomization.yaml
│           └── apps/
│               └── staging-app.yaml
```

### Application Discovery

Applications are discovered using the `.argocd-app` marker file:

**`.argocd-app` file format:**

```
infra-core-applications
```

This file should contain **one line** with the name of the ArgoCD Application that this directory maps to.

**Example:**

If your directory is `k8s/applications/default/` and contains a `.argocd-app` file with content `infra-core-applications`, then:

- The workflow will run validation and deployment for this directory
- It will use the ArgoCD application named `infra-core-applications`

### Required Tools (installed automatically)

The workflow automatically installs these tools:

- **kustomize** - Builds Kubernetes manifests
- **kubeconform** (optional) - Validates manifests against Kubernetes schemas
- **kube-score** (optional) - Scores manifests for best practices
- **argocd** - ArgoCD CLI for deployment operations

## Authentication Methods

### Method 1: DEX OIDC (Recommended)

Uses GitHub OIDC provider with DEX token exchange for keyless authentication.

**Required Configuration:**

- DEX server configured with GitHub connector
- ArgoCD AppProject roles mapping GitHub groups
- GitHub Actions as OIDC audience: `core-argocd-github-actions`

**Example ArgoCD AppProject RBAC:**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: my-project
spec:
  roles:
    - name: github-actions-sync
      groups:
        - repo:my-org/my-gitops-repo:ref:refs/heads/main
      policies:
        - p, proj:my-project:github-actions-sync, applications, get, my-project/*, allow
        - p, proj:my-project:github-actions-sync, applications, sync, my-project/*, allow

    - name: github-actions-diff
      groups:
        - repo:my-org/my-gitops-repo:pull_request
      policies:
        - p, proj:my-project:github-actions-diff, applications, get, my-project/*, allow
```

### Method 2: Token-based

Uses ArgoCD API tokens directly.

**Configuration:**

```yaml
inputs:
  auth-method: "token"
secrets:
  ARGOCD_TOKEN: $[object Object]
```

## Validation Details

### kustomize

Builds Kubernetes manifests from Kustomize overlays.

- `--load-restrictor LoadRestrictionsNone` - Allows loading from parent directories
- `--enable-helm` - Supports Helm charts in Kustomize

**Status:** Required (always runs)

### kubeconform

Validates Kubernetes resources against schemas.

- Strict validation mode
- Multiple schema sources (default K8s + custom CRDs)
- Summary output

**Status:** Critical - failures block deployment

### kube-score

Scores manifests for best practices.

- Security checks
- Resource limits validation
- Best practice recommendations

**Status:** Warning only - failures don't block deployment

## Workflow Execution

### Pull Request Flow

1. **Configure** - Determine commit SHA and discover applications
2. **Check** - Run code quality checks (formatting, linting)
3. **Preview** (per application, in parallel):
   - Validate manifests (kustomize, kubeconform, kube-score)
   - Setup ArgoCD authentication
   - Run `argocd app diff` against PR branch
   - Post diff as PR comment

### Main Branch Deployment Flow

1. **Configure** - Determine commit SHA and discover applications
2. **Check** - Run code quality checks
3. **Deploy** (per application, in parallel):
   - Validate manifests
   - Setup ArgoCD authentication
   - Check sync status (skip if already synced)
   - Create GitHub deployment
   - Sync ArgoCD application
   - Wait for health check
   - Update deployment status

## Advanced Configuration

### Custom Validation Schema Locations

Add your own CRD schemas:

```yaml
with:
  kubeconform-schema-locations: |
    default
    https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json
    https://storage.googleapis.com/my-company-crds/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json
```

### Disable Specific Validations

```yaml
with:
  enable-kubeconform: false # Disable schema validation
  enable-kube-score: false # Disable best practice checks
```

### Adjust Timeouts

For large or slow-deploying applications:

```yaml
with:
  sync-timeout: 1200 # 20 minutes
  health-timeout: 1200 # 20 minutes
```

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  gitops-deploy:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-deploy-v1
    with:
      argocd-server: ${{ <argocd-server> }}
```

[//]: # "x-release-please-end"

## Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-deploy-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-deploy-v1.0`: Targeting minor version <!-- x-release-please-minor -->
- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-deploy-v1.0.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                          | Description                                                                                                                                                                                                                                                                                                                                                                          | Required | Default                                                                                                                                 |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `default-branch`               | Default branch name for the repository.<br>**Example:** `main`, `master`, `develop`                                                                                                                                                                                                                                                                                                  | No       | `main`                                                                                                                                  |
| `applications-directory`       | Root directory containing application subdirectories.<br>**Example:** `k8s/applications`, `manifests/apps`                                                                                                                                                                                                                                                                           | No       | `k8s/applications`                                                                                                                      |
| `argocd-server`                | ArgoCD server hostname (without https://).<br>**Required:** Always<br>**Example:** `argocd.example.com`                                                                                                                                                                                                                                                                              | Yes      |                                                                                                                                         |
| `auth-method`                  | Authentication method for ArgoCD.<br>**Options:** `dex`, `token`<br>**Note:** DEX uses OIDC token exchange, token uses direct API token                                                                                                                                                                                                                                              | No       | `dex`                                                                                                                                   |
| `enable-kube-score`            | Enable kube-score validation (best practices).<br>**Note:** kube-score failures are warnings only, won't block deployment                                                                                                                                                                                                                                                            | No       | `true`                                                                                                                                  |
| `enable-kubeconform`           | Enable kubeconform validation (schema validation).<br>**Note:** kubeconform failures are critical and will block deployment                                                                                                                                                                                                                                                          | No       | `true`                                                                                                                                  |
| `kubeconform-schema-locations` | Newline-separated list of kubeconform schema locations.<br>**Default:** Default Kubernetes schemas + Datree CRDs catalog<br>**Example:**<br>`<br>default<br>https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json<br>https://storage.googleapis.com/custom-crds/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json<br>` | No       | `default<br>https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json<br>` |
| `sync-timeout`                 | ArgoCD sync timeout in seconds.<br>**Default:** `600` (10 minutes)                                                                                                                                                                                                                                                                                                                   | No       | `600`                                                                                                                                   |
| `health-timeout`               | ArgoCD health check timeout in seconds.<br>**Default:** `600` (10 minutes)                                                                                                                                                                                                                                                                                                           | No       | `600`                                                                                                                                   |
| `skip-if-synced`               | Skip deployment if application is already in sync.                                                                                                                                                                                                                                                                                                                                   | No       | `true`                                                                                                                                  |
| `enable-pr-comments`           | Enable posting diff comments on pull requests.                                                                                                                                                                                                                                                                                                                                       | No       | `true`                                                                                                                                  |
| `enable-github-deployments`    | Enable GitHub deployments API integration.<br>**Note:** Creates deployment records with links to ArgoCD UI                                                                                                                                                                                                                                                                           | No       | `true`                                                                                                                                  |

## Secrets

| Secret                           | Description                                                                                                                                                              | Required |
| :------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `DEX_ENDPOINT`                   | DEX OIDC server endpoint URL for ArgoCD authentication.<br>**Required:** When using DEX authentication method<br>**Example:** `https://dex.example.com`                  | No       |
| `DEX_GITHUB_ACTIONS_CLIENT`      | DEX client credentials (client_id:client_secret) for GitHub Actions.<br>**Required:** When using DEX authentication method<br>**Example:** `github-actions:secret_value` | No       |
| `DEX_GITHUB_ACTIONS_CONNECTOR`   | DEX connector ID for GitHub authentication.<br>**Required:** When using DEX authentication method<br>**Example:** `github`                                               | No       |
| `ARGOCD_TOKEN`                   | ArgoCD API token for direct authentication.<br>**Required:** When using token authentication method<br>**Example:** `argocd.token=eyJhbGc...`                            | No       |
| `GH_APP_IDENTIFICATION_RELEASER` | GitHub App identification for creating PRs (used in update-tags workflow).<br>**Required:** When using update-tags workflow                                              | No       |

## Outputs
