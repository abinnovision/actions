# GitOps Stack

CI/CD solution for ArgoCD-managed Kubernetes infrastructure. Provides automated validation, preview, and deployment of
applications through two complementary workflows.

## Repository Structure

```
gitops-repo/
├── k8s/
│   ├── applications/
│   │   ├── staging/
│   │   │   ├── .argocd-app
│   │   │   ├── kustomization.yaml
│   │   │   └── *.yaml
│   │   └── production/
│   │       ├── .argocd-app
│   │       ├── kustomization.yaml
│   │       └── *.yaml
│   └── base/
│       └── <shared-resources>/
├── .github/workflows/
│   ├── ci.yaml
│   └── update-tags.yaml
├── .tool-versions
├── package.json
└── yarn.lock
```

## Application Example

### .argocd-app

Single-line file containing the ArgoCD Application name:

```
my-app-staging
```

### kustomization.yaml

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

## Root files

### .tool-versions

Tool versions for all jobs (see [setup-tools](../../actions/setup-tools/README.md)). `Check` uses Node.js and the
validation tools, `Preview` and `Deploy` use `argocd`, and `gitops-update-tags` uses Node.js and `kustomize`:

```
nodejs 24.18.0
kustomize 5.7.1
kubeconform 0.7.0
kube-score 1.20.0
argocd 3.1.8
```

### package.json

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

## Workflows

### gitops-stack

Checks the repository, validates manifests and deploys to ArgoCD. Runs the jobs `Configure`, `Check`, `Preview`,
`Deploy` and `Status`.

- Every change: Validates the manifests of every application directory in `Check`
- Pull requests: Posts the ArgoCD diff of every application with `.argocd-app` as a PR comment
- Main branch: Triggers an ArgoCD sync of every application with `.argocd-app` without waiting for health, in a GitHub
  environment named after the application
- Pull requests from forks and from Dependabot only run `Configure` and `Check`
- Triggered by `pull_request` and `push`; `pull_request_target` is rejected
- The required status check is `CI / Status`

ArgoCD and DEX are configured through repository variables:

| Variable                       | Description                                       |
| :----------------------------- | :------------------------------------------------ |
| `ARGOCD_SERVER`                | ArgoCD server hostname, without `https://`        |
| `DEX_ENDPOINT`                 | DEX issuer URL                                    |
| `DEX_GITHUB_ACTIONS_CLIENT_ID` | ID of the public DEX client for GitHub Actions    |
| `DEX_GITHUB_ACTIONS_CONNECTOR` | ID of the DEX connector for GitHub Actions tokens |

Repositories using `gitops-deploy` or an older major follow the migration steps in the reference.

**Reference:** [`workflows/gitops-stack`](../../workflows/gitops-stack/README.md)

### gitops-update-tags

Updates image tags in kustomization files and creates PRs.

- Updates `kustomization.yaml` using `kustomize edit set image`
- Groups multiple updates into single PR when possible
- Formats files with prettier before committing

**Reference:** [`workflows/gitops-update-tags`](../../workflows/gitops-update-tags/README.md)

## Workflow Examples

### ci.yaml

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

permissions: {}

jobs:
  ci:
    name: CI
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-stack-v2
    permissions:
      contents: read
      packages: read
      id-token: write
      pull-requests: write
```

### update-tags.yaml

```yaml
name: Update Tags

on:
  workflow_dispatch:
    inputs:
      application:
        description: "Application to update"
        required: true
      updates:
        description: "Image updates as CSV (image:tag,image2:tag2)"
        required: true

jobs:
  update:
    name: Update Tags
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v2
    permissions:
      contents: read
      id-token: write
    with:
      application: ${{ github.event.inputs.application }}
      updates: ${{ github.event.inputs.updates }}
      # Auto-merge staging when all images are updated
      automerge-images: ${{ github.event.inputs.application == 'staging' && 'app-backend,app-frontend' || '' }}
```
