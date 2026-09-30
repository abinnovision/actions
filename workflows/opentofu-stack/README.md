# opentofu-stack

Checks, plans and applies an OpenTofu root module with GCS state and encrypted state files.

## Behavior

| Job         | Runs on                                | Does                                                                                                  |
| :---------- | :------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| `Configure` | Always                                 | Resolves the mode (`plan`, `apply` or none) and validates the configuration                           |
| `Check`     | Always                                 | `tofu fmt -check -recursive`, `tofu init -backend=false`, `tofu validate`                             |
| `Plan`      | Pull requests from the same repository | `tofu plan` and one sticky PR comment per `working-directory` with the summary and a collapsible diff |
| `Apply`     | Push to `default-branch`               | Fresh `tofu plan -out` and `tofu apply` in `apply-environment`; runs for one root never overlap       |

- State and plan files are always encrypted with OpenTofu's `gcp_kms` key provider
- Optional GitHub token exchange via the token broker, passed as `GITHUB_TOKEN` to the GitHub provider
- Pull requests from forks only run `Check`, since they cannot authenticate to GCP
- `pull_request_target` is rejected
- Tool versions come from `.tool-versions` (see [setup-tools](../../actions/setup-tools/README.md))

## Requirements

- The repository is provisioned by foundry with `foundry-state-backend: true`, which publishes the
  `FOUNDRY_WIF_PROVIDER`, `FOUNDRY_STATE_BUCKET` and `FOUNDRY_STATE_KEY` variables. The
  `gcp-workload-identity-provider`, `state-bucket` and `state-key` inputs override them
- The `apply-environment` environment (default `production`) is restricted to the default branch
- The root module declares an empty GCS backend:

```hcl
terraform {
  backend "gcs" {}
}
```

## Usage

This is a `workflow_call` workflow, so it can't be triggered directly. Call it from a workflow triggered by
`pull_request` and `push` (never `pull_request_target`).

[//]: # "x-release-please-start-major"

```yaml
jobs:
  opentofu-stack:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@opentofu-stack-v0
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@opentofu-stack-v0`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@opentofu-stack-v0.0.0`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

Complete, copyable caller workflow (e.g. `.github/workflows/tofu.yaml`):

[//]: # "x-release-please-start-major"

```yaml
name: OpenTofu

on:
  pull_request:
  push:
    branches: [main]

jobs:
  tofu:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@opentofu-stack-v0
    permissions:
      contents: read
      id-token: write
      pull-requests: write
    with:
      working-directory: infra
```

[//]: # "x-release-please-end"

Repositories with several roots call the workflow once per root with different `working-directory` values.

## Advanced Configuration

### State encryption migration

The encryption config allows reading an existing unencrypted state as a fallback. The first apply rewrites
the state encrypted. Plans on pull requests run with `-lock=false` and never write state.

### GitHub provider token

Set `github-token-plan-scope` and/or `github-token-apply-scope` to exchange a GitHub App token through the
token broker. Use the read-only scopes for plan and the write scopes for apply.

```yaml
with:
  github-token-plan-scope: contents:read
  github-token-apply-scope: contents:write
```

## Inputs

| Input                            | Description                                                                                                                                                                                                                                                            | Required | Default      |
| :------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------- |
| `working-directory`              | Root module directory, passed to `tofu -chdir`.<br>**Default:** `tofu`<br>**Example:** `infra`, `tofu/production`                                                                                                                                                      | No       | `tofu`       |
| `gcp-workload-identity-provider` | Full Workload Identity Federation provider resource name.<br>Authenticates directly as the repository without a service account.<br>This is public configuration, not a secret.<br>**Default:** Falls back to `vars.FOUNDRY_WIF_PROVIDER` if not provided.             | No       | _empty_      |
| `state-bucket`                   | GCS bucket holding the state.<br>**Default:** Falls back to `vars.FOUNDRY_STATE_BUCKET` if not provided.                                                                                                                                                               | No       | _empty_      |
| `state-key`                      | Full KMS crypto key resource name used to encrypt the state and plan files.<br>**Default:** Falls back to `vars.FOUNDRY_STATE_KEY` if not provided.                                                                                                                    | No       | _empty_      |
| `state-prefix`                   | Prefix of the GCS state object, so several roots can share one bucket.<br>**Default:** Falls back to `working-directory` if not provided.                                                                                                                              | No       | _empty_      |
| `default-branch`                 | Branch that triggers the apply job on push.<br>**Default:** `main`                                                                                                                                                                                                     | No       | `main`       |
| `apply-environment`              | GitHub environment used by the apply job. Set to an empty string to disable.<br>**Default:** `production`                                                                                                                                                              | No       | `production` |
| `token-broker-url`               | URL of the token broker for OIDC token exchange.<br>**Default:** Falls back to `vars.TOKEN_BROKER_URL` if not provided.                                                                                                                                                | No       | _empty_      |
| `github-token-plan-scope`        | Token broker scopes for the GitHub token used by plan, whitespace-separated.<br>The token is exported as `GITHUB_TOKEN` for the OpenTofu GitHub provider.<br>**Default:** Empty, the token exchange is skipped.<br>**Example:** `contents:read administration:read`    | No       | _empty_      |
| `github-token-apply-scope`       | Token broker scopes for the GitHub token used by apply, whitespace-separated.<br>The token is exported as `GITHUB_TOKEN` for the OpenTofu GitHub provider.<br>**Default:** Empty, the token exchange is skipped.<br>**Example:** `contents:write administration:write` | No       | _empty_      |
| `github-token-resources`         | Resources the exchanged GitHub token can access, using typed prefixes<br>(`repo:owner/name`, `org:name`, `enterprise:slug`), whitespace-separated.<br>**Default:** Empty, the token is scoped to the current repository.                                               | No       | _empty_      |
