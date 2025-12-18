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
│   ├── deploy.yaml
│   └── update-tags.yaml
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

### gitops-deploy

Validates manifests and deploys to ArgoCD.

- Pull requests: Validates manifests, posts ArgoCD diff as PR comment
- Main branch: Validates manifests, syncs to ArgoCD, waits for health

**Reference:** [`workflows/gitops-deploy`](../../workflows/gitops-deploy/README.md)

### gitops-update-tags

Updates image tags in kustomization files and creates PRs.

- Updates `kustomization.yaml` using `kustomize edit set image`
- Groups multiple updates into single PR when possible
- Formats files with prettier before committing

**Reference:** [`workflows/gitops-update-tags`](../../workflows/gitops-update-tags/README.md)

## Workflow Examples

### deploy.yaml

```yaml
name: Deploy

on:
  push:
    branches:
      - main
  pull_request_target:
    branches:
      - main

concurrency:
  group: ${{ github.workflow }}-${{ github.event_name == 'pull_request_target' && format('pr-{0}', github.event.number) || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request_target' }}

jobs:
  deploy:
    name: GitOps Deploy
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-deploy-v1
    permissions:
      contents: read
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

### update-tags.yaml

```yaml
name: Update Tags

on:
  workflow_dispatch:
    inputs:
      application:
        description: "Application to update"
        required: true
      tag:
        description: "Tag to update the image to"
        required: true
      image:
        description: "Name of the image to update"
        required: false
        default: "image"

jobs:
  update:
    name: Update Tags
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-update-tags-v1
    permissions:
      contents: read
      id-token: write
    with:
      application: ${{ github.event.inputs.application }}
      tag: ${{ github.event.inputs.tag }}
      image: ${{ github.event.inputs.image }}
      # Auto-merge staging when all images are updated
      automerge-images: ${{ github.event.inputs.application == 'staging' && 'app-backend,app-frontend' || '' }}
    secrets:
      GH_APP_IDENTIFICATION_RELEASER: ${{ secrets.GH_APP_IDENTIFICATION_RELEASER }}
```
