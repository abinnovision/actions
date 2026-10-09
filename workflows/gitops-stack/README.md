# gitops-stack

Validates manifests and deploys ArgoCD applications.

It follows the shared [stack contract](../../docs/stacks/README.md) for calling, naming, jobs and required checks.

## Behavior

| Job               | Runs                                                                 | Does                                                                                                                                |
| :---------------- | :------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `Configure`       | Always                                                               | Resolves the mode (`pr`, `main` or `none`) and whether the event is trusted, validates the configuration and discovers applications |
| `Check`           | Always                                                               | Repository baseline checks (install, dedupe, `check`), then validates the manifests of every application, without credentials       |
| `Preview: <name>` | Trusted pull requests, one job per application with `.argocd-app`    | Posts the ArgoCD diff as a PR comment                                                                                               |
| `Deploy: <name>`  | Push to `default-branch`, one job per application with `.argocd-app` | Triggers an ArgoCD sync and confirms it started without immediate errors (does not wait for health)                                 |
| `Status`          | Always                                                               | Single required status check, fails when any other job failed or was cancelled                                                      |

- Every directory in `applications-directory` is an application and is validated in `Check`: `kustomize build`
  (with Helm), `kubeconform` (fails the job) and `kube-score` (warnings only). The logs are uploaded as the
  `validation-logs` artifact. Directories without a `kustomization.yaml`, `kustomization.yml` or `Kustomization` file
  are skipped
- Directories with an `.argocd-app` file also get a `Preview` and a `Deploy` job. ArgoCD renders the manifests
  server-side, so these jobs only check out the root files
- The preview comment is updated on every run: it shows the diff, notes that there are no changes or that the preview
  failed
- With `enable-github-deployments`, each `Deploy` job runs in a GitHub environment named after the application, linked
  to the application in the ArgoCD UI. Every `Deploy` job records a GitHub deployment, also when the application was
  already in sync
- Pull requests from forks and from Dependabot only run `Configure` and `Check`, since they cannot authenticate to ArgoCD
- `pull_request_target` is rejected
- Application directory names must match `^[A-Za-z0-9][A-Za-z0-9._-]*$`
- Concurrency is owned by the caller
- Tool versions come from `.tool-versions` (see [setup-tools](../../actions/setup-tools/README.md))

## Requirements

- The repository has a `.tool-versions` file with `nodejs`, `kustomize` and `argocd`, plus `kubeconform` and
  `kube-score` unless disabled, and a `package.json` with a `check` script. `kustomize build --enable-helm` needs
  `helm` when an application uses Helm charts
- The caller grants `contents: read`, `packages: read`, `id-token: write` and `pull-requests: write`
- The repository variables `ARGOCD_SERVER`, `DEX_ENDPOINT`, `DEX_GITHUB_ACTIONS_CLIENT_ID` and
  `DEX_GITHUB_ACTIONS_CONNECTOR` are set, or the matching inputs are passed. `Configure` fails when one is missing and
  a `Preview` or `Deploy` job would run
- The DEX client is a public client. DEX and ArgoCD accept the GitHub Actions OIDC token with the subject
  `repo:<owner>/<repo>:pull_request` for previews and, for deploys, `repo:<owner>/<repo>:environment:<name>` with
  `enable-github-deployments` or `repo:<owner>/<repo>:ref:refs/heads/<default-branch>` without it

## Usage

This is a `workflow_call` workflow, so it can't be triggered directly. Call it from a workflow triggered by
`pull_request` and `push` (never `pull_request_target`).

[//]: # "x-release-please-start-major"

```yaml
jobs:
  gitops-stack:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@gitops-stack-v1
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
```

[//]: # "x-release-please-end"

The ArgoCD and DEX settings are read from the repository variables. Pass `argocd-server`, `dex-endpoint`,
`dex-client-id` or `dex-connector` to override them.

| Variable                       | Description                                       |
| :----------------------------- | :------------------------------------------------ |
| `ARGOCD_SERVER`                | ArgoCD server hostname, without `https://`        |
| `DEX_ENDPOINT`                 | DEX issuer URL                                    |
| `DEX_GITHUB_ACTIONS_CLIENT_ID` | ID of the public DEX client for GitHub Actions    |
| `DEX_GITHUB_ACTIONS_CONNECTOR` | ID of the DEX connector for GitHub Actions tokens |

### Migrating from gitops-stack v1

- Remove the `secrets:` block. `DEX_ENDPOINT`, `DEX_GITHUB_ACTIONS_CLIENT` and `DEX_GITHUB_ACTIONS_CONNECTOR` become
  the variables `DEX_ENDPOINT`, `DEX_GITHUB_ACTIONS_CLIENT_ID` (client ID only) and `DEX_GITHUB_ACTIONS_CONNECTOR`, or
  the inputs `dex-endpoint`, `dex-client-id` and `dex-connector`
- Configure the DEX client as a public client; no client secret is sent
- Remove `auth-method` and `health-timeout`. Token authentication (`ARGOCD_TOKEN`) is no longer supported
- `argocd-server` is optional and falls back to `vars.ARGOCD_SERVER`
- Add `kustomize`, `kubeconform`, `kube-score` and `argocd` to `.tool-versions`
- Job names change to `Preview: <name>` and `Deploy: <name>`; `CI / Status` stays the required check
- With `enable-github-deployments`, deploy jobs authenticate with the subject
  `repo:<owner>/<repo>:environment:<name>`. Update the DEX and ArgoCD mappings to allow it
- The caller no longer needs `deployments: write`
- Deploy jobs no longer set `concurrency`; the caller's `concurrency` applies
- `Preview` and `Deploy` wait for `Check`, so invalid manifests are never deployed
- Directories without a kustomization file are skipped by validation
- With `enable-github-deployments`, every `Deploy` job records a GitHub deployment, also when the application was already in sync

### Migrating from gitops-deploy

- Use the `gitops-stack-v1` tag instead of `gitops-deploy-v1` <!-- x-release-please-major -->
- Switch the caller trigger from `pull_request_target` to `pull_request`
- Make `CI / Status` the required status check
- Add a `.tool-versions` file with `nodejs` and the Kubernetes tools
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

`.tool-versions` pins the tools of every job (see [setup-tools](../../actions/setup-tools/README.md)). `Check` uses
Node.js and the validation tools, `Preview` and `Deploy` use `argocd`, and
[gitops-update-tags](../gitops-update-tags/README.md) uses Node.js and `kustomize`:

```
nodejs 24.18.0
kustomize 5.7.1
kubeconform 0.7.0
kube-score 1.20.0
argocd 3.1.8
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

| Tool          | Purpose           | Impact        |
| ------------- | ----------------- | ------------- |
| `kustomize`   | Build manifests   | Required      |
| `kubeconform` | Schema validation | Fails `Check` |
| `kube-score`  | Best practices    | Warning only  |

## Advanced Configuration

### Custom Validation Schema Locations

Setting this input replaces the built-in Kubernetes schemas unless `default` is listed.

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
| `argocd-server`                | ArgoCD server hostname (without https://).<br>**Default:** Falls back to `vars.ARGOCD_SERVER` if not provided.<br>**Example:** `argocd.example.com`                                                                                                                                                                                                                                  | No       | _empty_                                                                                                                                 |
| `dex-endpoint`                 | DEX OIDC issuer URL used to exchange the GitHub Actions OIDC token for an ArgoCD token.<br>This is public configuration, not a secret.<br>**Default:** Falls back to `vars.DEX_ENDPOINT` if not provided.<br>**Example:** `https://dex.example.com`                                                                                                                                  | No       | _empty_                                                                                                                                 |
| `dex-client-id`                | ID of the public DEX client for GitHub Actions.<br>**Default:** Falls back to `vars.DEX_GITHUB_ACTIONS_CLIENT_ID` if not provided.<br>**Example:** `github-actions`                                                                                                                                                                                                                  | No       | _empty_                                                                                                                                 |
| `dex-connector`                | ID of the DEX connector that accepts GitHub Actions OIDC tokens.<br>**Default:** Falls back to `vars.DEX_GITHUB_ACTIONS_CONNECTOR` if not provided.<br>**Example:** `github-actions`                                                                                                                                                                                                 | No       | _empty_                                                                                                                                 |
| `default-branch`               | Default branch name for the repository.<br>**Example:** `main`, `master`, `develop`                                                                                                                                                                                                                                                                                                  | No       | `main`                                                                                                                                  |
| `applications-directory`       | Root directory containing application subdirectories.<br>**Example:** `k8s/applications`, `manifests/apps`                                                                                                                                                                                                                                                                           | No       | `k8s/applications`                                                                                                                      |
| `enable-kube-score`            | Enable kube-score validation (best practices).<br>**Note:** kube-score failures are warnings only, won't block deployment                                                                                                                                                                                                                                                            | No       | `true`                                                                                                                                  |
| `enable-kubeconform`           | Enable kubeconform validation (schema validation).<br>**Note:** kubeconform failures are critical and will block deployment                                                                                                                                                                                                                                                          | No       | `true`                                                                                                                                  |
| `kubeconform-schema-locations` | Newline-separated list of kubeconform schema locations.<br>**Default:** Default Kubernetes schemas + Datree CRDs catalog<br>**Example:**<br>`<br>default<br>https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json<br>https://storage.googleapis.com/custom-crds/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json<br>` | No       | `default<br>https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json<br>` |
| `sync-timeout`                 | Timeout in seconds for the post-trigger check that the sync operation started without immediate errors.<br>**Note:** The sync itself runs asynchronously; this only bounds a short check, not the full sync duration.<br>**Default:** `120` (2 minutes)                                                                                                                              | No       | `120`                                                                                                                                   |
| `skip-if-synced`               | Skip deployment if application is already in sync.                                                                                                                                                                                                                                                                                                                                   | No       | `true`                                                                                                                                  |
| `sync-prune`                   | Enable pruning of resources that are no longer defined in the source.<br>**Note:** When enabled, resources removed from manifests will be deleted during sync                                                                                                                                                                                                                        | No       | _empty_                                                                                                                                 |
| `enable-pr-comments`           | Enable posting diff comments on pull requests.                                                                                                                                                                                                                                                                                                                                       | No       | `true`                                                                                                                                  |
| `enable-github-deployments`    | Run each deploy job in a GitHub environment named after the application, with a link to the ArgoCD UI.<br>**Note:** Changes the OIDC subject of deploy jobs to `repo:<owner>/<repo>:environment:<application>`                                                                                                                                                                       | No       | `true`                                                                                                                                  |

## Outputs
