# gitops-deploy

Validates manifests and deploys ArgoCD applications.

> For repository setup, see [GitOps Stack documentation](../../docs/gitops-stack/README.md).

## Behavior

- **Pull requests:** Validates manifests, posts ArgoCD diff as PR comment
- **Main branch:** Validates manifests, syncs to ArgoCD, waits for health

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

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-deploy-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-deploy-v1.0.2`: Targeting a patch version <!-- x-release-please-version -->

## Validation Tools

| Tool          | Purpose           | Impact            |
| ------------- | ----------------- | ----------------- |
| `kustomize`   | Build manifests   | Required          |
| `kubeconform` | Schema validation | Blocks deployment |
| `kube-score`  | Best practices    | Warning only      |

## Advanced Configuration

### Custom Validation Schema Locations

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
	enable-kubeconform: false
	enable-kube-score: false
```

### Adjust Timeouts

```yaml
with:
	sync-timeout: 1200
	health-timeout: 1200
```

## Inputs

| Input                          | Description                                                                                                                                                                                                                                                                                                                                                                          | Required | Default                                                                                                                                 |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `argocd-server`                | ArgoCD server hostname (without https://).<br>**Required:** Always<br>**Example:** `argocd.example.com`                                                                                                                                                                                                                                                                              | Yes      |                                                                                                                                         |
| `default-branch`               | Default branch name for the repository.<br>**Example:** `main`, `master`, `develop`                                                                                                                                                                                                                                                                                                  | No       | `main`                                                                                                                                  |
| `applications-directory`       | Root directory containing application subdirectories.<br>**Example:** `k8s/applications`, `manifests/apps`                                                                                                                                                                                                                                                                           | No       | `k8s/applications`                                                                                                                      |
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

| Secret                         | Description                                                                                                                                                              | Required |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `DEX_ENDPOINT`                 | DEX OIDC server endpoint URL for ArgoCD authentication.<br>**Required:** When using DEX authentication method<br>**Example:** `https://dex.example.com`                  | No       |
| `DEX_GITHUB_ACTIONS_CLIENT`    | DEX client credentials (client_id:client_secret) for GitHub Actions.<br>**Required:** When using DEX authentication method<br>**Example:** `github-actions:secret_value` | No       |
| `DEX_GITHUB_ACTIONS_CONNECTOR` | DEX connector ID for GitHub authentication.<br>**Required:** When using DEX authentication method<br>**Example:** `github`                                               | No       |
| `ARGOCD_TOKEN`                 | ArgoCD API token for direct authentication.<br>**Required:** When using token authentication method<br>**Example:** `argocd.token=eyJhbGc...`                            | No       |

## Outputs
