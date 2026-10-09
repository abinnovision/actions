# gitops-stack

Validates manifests and deploys ArgoCD applications.

## Behavior

| Job         | Runs on                                                         | Does                                                                                                                     |
| :---------- | :-------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| `Configure` | Always                                                          | Resolves the mode (`pr`, `main` or none) and discovers applications in `applications-directory`                          |
| `Check`     | Always                                                          | Repository baseline checks (install, dedupe, `check`), without credentials                                               |
| `Preview`   | Pull requests from the same repository, one job per application | Validates manifests and posts the ArgoCD diff as a PR comment                                                            |
| `Deploy`    | Push to `default-branch`, one job per application               | Validates manifests, triggers an ArgoCD sync and confirms it started without immediate errors (does not wait for health) |
| `Status`    | Always                                                          | Single required status check, fails if any other job failed or was cancelled                                             |

- Pull requests from forks and from Dependabot only run `Configure` and `Check`, since they cannot authenticate to ArgoCD
- `pull_request_target` is rejected
- Application directory names must match `^[A-Za-z0-9][A-Za-z0-9._-]*$`
- Tool versions come from `.tool-versions` (see [setup-tools](../../actions/setup-tools/README.md))

## Requirements

- The repository has a `.tool-versions` file with `nodejs` and a `package.json` with a `check` script
- The caller grants `contents: read`, `packages: read`, `id-token: write`, `pull-requests: write` and `deployments: write`
- ArgoCD (or DEX) accepts the GitHub Actions OIDC token of `pull_request` and `push` runs, or an ArgoCD token is provided

## Usage

This is a `workflow_call` workflow, so it can't be triggered directly. Call it from a workflow triggered by
`pull_request` and `push` (never `pull_request_target`).

[//]: # "x-release-please-start-major"

```yaml
jobs:
  gitops-stack:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-stack-v1
    with:
      argocd-server: ${{ <argocd-server> }}
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-stack-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@gitops-stack-v1.0.1`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

Complete, copyable caller workflow (`.github/workflows/ci.yaml`). The required status check is `CI / Status`.

[//]: # "x-release-please-start-major"

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}-${{ github.event.pull_request.number || github.event.merge_group.id || 'main' }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' || github.event_name == 'merge_group' }}

permissions: {}

jobs:
  ci:
    name: CI
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-stack-v1
    permissions:
      contents: read
      packages: read
      id-token: write
      pull-requests: write
      deployments: write
    with:
      argocd-server: ${{ vars.ARGOCD_SERVER }}
      auth-method: dex
    secrets:
      DEX_ENDPOINT: ${{ vars.DEX_ENDPOINT }}
      DEX_GITHUB_ACTIONS_CLIENT: ${{ vars.DEX_GITHUB_ACTIONS_CLIENT }}
      DEX_GITHUB_ACTIONS_CONNECTOR: ${{ vars.DEX_GITHUB_ACTIONS_CONNECTOR }}
```

[//]: # "x-release-please-end"

### Migrating from gitops-deploy

- Use the `gitops-stack-v1` tag instead of `gitops-deploy-v1` <!-- x-release-please-major -->
- Switch the caller trigger from `pull_request_target` to `pull_request`
- Make `CI / Status` the required status check
- Add a `.tool-versions` file with `nodejs`
- Pull request runs now authenticate with the OIDC identity of a `pull_request` event (subject
  `repo:<owner>/<repo>:pull_request`). ArgoCD and DEX RBAC rules must accept it

## Repository layout

### Directory structure

```
gitops-repo/
├── .github/workflows/
│   ├── ci.yaml
│   └── update-tags.yaml   # see gitops-update-tags
├── .tool-versions
├── package.json
├── yarn.lock
└── k8s/
    ├── applications/      # applications-directory, one directory per application
    │   ├── staging/
    │   │   ├── .argocd-app
    │   │   ├── kustomization.yaml
    │   │   └── *.yaml
    │   └── production/
    │       └── ...
    └── base/
        └── <shared-resources>/
```

### Applications

Each application directory holds a `.argocd-app` file with the name of its ArgoCD Application on a single line:

```
my-app-staging
```

and a `kustomization.yaml`. Image entries are the targets of
[gitops-update-tags](../gitops-update-tags/README.md):

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: app-my-app-staging

resources:
  - ../../base/backend
  - ../../base/frontend
  - ./ingress.yaml

images:
  - name: app-backend
    newName: ghcr.io/org/app-backend
    newTag: sha-abc1234
  - name: app-frontend
    newName: ghcr.io/org/app-frontend
    newTag: sha-abc1234
```

### Root files

`.tool-versions` pins the Node.js version used by `Check`:

```
nodejs 24.18.0
```

The root `package.json` provides the `check` script, here formatting only:

```json
{
  "private": true,
  "packageManager": "yarn@4.9.2",
  "scripts": {
    "check": "yarn format:check",
    "format:check": "prettier --check '{.github/**/*,k8s/**/*,*}.{json,json5,yaml,yml,md}'",
    "format:fix": "prettier --write '{.github/**/*,k8s/**/*,*}.{json,json5,yaml,yml,md}'",
    "postinstall": "husky"
  },
  "commitlint": {
    "extends": ["@abinnovision/commitlint-config"]
  },
  "lint-staged": {
    "{.github/**/*,k8s/**/*,*}.{json,json5,yaml,yml,md}": ["prettier --write"]
  },
  "prettier": "@abinnovision/prettier-config",
  "devDependencies": {
    "@abinnovision/commitlint-config": "^2.2.1",
    "@abinnovision/prettier-config": "^2.1.3",
    "@commitlint/cli": "^20.1.0",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.6",
    "prettier": "^3.6.2"
  }
}
```

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
	sync-timeout: 300 # bounds only the immediate post-trigger error check, not the full sync
```

### Conditional Pruning

`sync-prune` is a plain boolean input, so it can be set to any expression evaluated by the calling workflow:

```yaml
with:
	sync-prune: ${{ github.ref == 'refs/heads/main' }}
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
| `sync-timeout`                 | Timeout in seconds for the post-trigger check that the sync operation started without immediate errors.<br>**Note:** The sync itself runs asynchronously; this only bounds a short check, not the full sync duration.<br>**Default:** `120` (2 minutes)                                                                                                                              | No       | `120`                                                                                                                                   |
| `health-timeout`               | **Deprecated:** No longer used. The workflow no longer waits for application health after sync.<br>Kept for backward compatibility; has no effect.                                                                                                                                                                                                                                   | No       | `600`                                                                                                                                   |
| `skip-if-synced`               | Skip deployment if application is already in sync.                                                                                                                                                                                                                                                                                                                                   | No       | `true`                                                                                                                                  |
| `sync-prune`                   | Enable pruning of resources that are no longer defined in the source.<br>**Note:** When enabled, resources removed from manifests will be deleted during sync                                                                                                                                                                                                                        | No       | _empty_                                                                                                                                 |
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
