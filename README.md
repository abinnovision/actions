# iac-stack

Checks, plans and applies an OpenTofu root module with GCS state and encrypted state files, next to the Node repo checks.

It follows the shared [stack contract](../../docs/stacks/README.md) for calling, naming, jobs and required checks.

## Behavior

| Job             | Runs                     | Does                                                                                                                                                                                                                   |
| :-------------- | :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Configure`     | Always                   | Resolves the mode (`pr`, `main` or `none`) and whether the event is trusted, and validates the configuration                                                                                                           |
| `Check`         | Always                   | Node repo checks (`yarn install --immutable`, `yarn dedupe --check`, `yarn check`), then `tofu fmt -check -recursive`, `tofu init -backend=false`, `tofu validate` for every root, and `tofu test` with `enable-tests` |
| `Plan: <root>`  | Trusted pull requests    | `tofu plan` per root and one sticky PR comment per root via [terraform-plan-comment](https://github.com/borchero/terraform-plan-comment); a failed plan replaces it with a link to the run                             |
| `Apply: <root>` | Push to `default-branch` | Fresh `tofu plan -out` and `tofu apply` per root in `apply-environment`                                                                                                                                                |
| `Status`        | Always                   | Single required status check, fails when any other job failed or was cancelled                                                                                                                                         |

- `working-directory` takes patterns, one per line, where `*` matches one path segment and skips dot directories. Every pattern must match a root. Every matching directory with a `*.tf` or `*.tofu` file is a root and gets its own `Plan` and `Apply` job
- State and plan files are always encrypted with OpenTofu's `gcp_kms` key provider
- Optional GitHub token exchange via the token broker, passed as `GITHUB_TOKEN` to the GitHub provider
- Pull requests from forks and from Dependabot only run `Configure` and `Check`, since they cannot authenticate to GCP

## Requirements

- The repository is provisioned by foundry with `foundry-state-backend: true`, which publishes the
  `FOUNDRY_WIF_PROVIDER`, `FOUNDRY_STATE_BUCKET` and `FOUNDRY_STATE_KEY` variables. The
  `gcp-workload-identity-provider`, `state-bucket` and `state-key` inputs override them
- The repository has a `.tool-versions` file with `nodejs` and `opentofu`, and a `package.json` with a `check` script
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
  iac-stack:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@iac-stack-v1
```

[//]: # "x-release-please-end"

### Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@iac-stack-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@iac-stack-v1.3.1`: Targeting a patch version <!-- x-release-please-version -->

### Example Workflow File

Complete, copyable caller workflow (`.github/workflows/ci.yaml`):

[//]: # "x-release-please-start-major"

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions: {}

jobs:
  ci:
    name: CI
    uses: abinnovision/actions/.github/workflows/workflow.yaml@iac-stack-v1
    permissions:
      contents: read
      packages: read
      id-token: write
      pull-requests: write
    with:
      working-directory: infra
```

[//]: # "x-release-please-end"

Repositories with several roots list one pattern per line in `working-directory`, for example `tofu/*`, and keep a single caller job (see [Several roots](#several-roots)). Concurrency is owned by the caller.

## Migrating from opentofu-stack

- Change the caller tag to `@iac-stack-v1` (previously `@opentofu-stack-v1`) <!-- x-release-please-major -->
- The required status check becomes `CI / Status` (with the caller convention above)
- The Node repo checks now run inside `Check`, so a separate repo checks job can be removed

## Advanced Configuration

### State encryption migration

The encryption config allows reading an existing unencrypted state as a fallback. The first apply rewrites
the state encrypted. Plans on pull requests run with `-lock=false` and never write state.

### Tests

Set `enable-tests: true` to run `tofu test` for every root inside `Check`. Test files (`*.tftest.hcl` or
`*.tofutest.hcl`) live in the root or its `tests/` directory; roots without test files are skipped.

`Check` has no credentials, so tests must not reach real APIs. Use `mock_provider` (OpenTofu 1.8 or later),
`override_resource` or `override_data`; `command = plan` alone still configures the provider. Tests keep their state in memory and never touch the GCS backend.

```hcl
# tofu/tests/bucket.tftest.hcl
mock_provider "google" {}

run "bucket_name" {
  command = plan

  assert {
    condition     = google_storage_bucket.this.name == "example"
    error_message = "unexpected bucket name"
  }
}
```

### GitHub provider token

Set `github-token-plan-scope` and/or `github-token-apply-scope` to exchange a GitHub App token through the
token broker. Use the read-only scopes for plan and the write scopes for apply.

```yaml
with:
  github-token-plan-scope: contents:read
  github-token-apply-scope: contents:write
```

### Several roots

One call covers every root. `state-prefix` takes the placeholders `{path}` (root directory) and `{name}` (its last
segment, the repository name for the root `.`), so existing state objects keep their prefix. `github-token-roots` limits the exchanged GitHub token to the
roots that need it; the other roots run without `GITHUB_TOKEN`.

```yaml
with:
  working-directory: tofu/*
  # tofu/core -> core, tofu/github -> github
  state-prefix: "{name}"
  github-token-roots: tofu/github
  github-token-resources: org:example
  github-token-plan-scope: administration:read
  github-token-apply-scope: administration:write
```

## Inputs

| Input                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                               | Required | Default      |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :----------- |
| `working-directory`              | Root module directories, one pattern per line.<br>`*` matches exactly one path segment and skips dot directories. Only directories with a `*.tf` or `*.tofu` file count.<br>Every pattern must match a root.<br>**Default:** `tofu`<br>**Example:** `infra`, `tofu/*`                                                                                                                                                                     | No       | `tofu`       |
| `enable-tests`                   | Run `tofu test` for every root in the Check job, without credentials.<br>Providers must be mocked, since `command = plan` still configures them.<br>**Default:** `false`                                                                                                                                                                                                                                                                  | No       | _empty_      |
| `gcp-workload-identity-provider` | Full Workload Identity Federation provider resource name.<br>Authenticates directly as the repository without a service account.<br>This is public configuration, not a secret.<br>**Default:** Falls back to `vars.FOUNDRY_WIF_PROVIDER` if not provided.                                                                                                                                                                                | No       | _empty_      |
| `state-bucket`                   | GCS bucket holding the state.<br>**Default:** Falls back to `vars.FOUNDRY_STATE_BUCKET` if not provided.                                                                                                                                                                                                                                                                                                                                  | No       | _empty_      |
| `state-key`                      | Full KMS crypto key resource name used to encrypt the state and plan files.<br>**Default:** Falls back to `vars.FOUNDRY_STATE_KEY` if not provided.                                                                                                                                                                                                                                                                                       | No       | _empty_      |
| `state-prefix`                   | Prefix of the GCS state object, so several roots can share one bucket.<br>`{path}` expands to the root directory and `{name}` to its last segment, the repository name for the root `.`. Expanded prefixes must be unique.<br>A prefix without placeholders is only allowed when `working-directory` matches exactly one root.<br>**Default:** Falls back to the root directory if not provided.<br>**Example:** `{name}`, `infra/{path}` | No       | _empty_      |
| `default-branch`                 | Branch that triggers the apply job on push.<br>**Default:** `main`                                                                                                                                                                                                                                                                                                                                                                        | No       | `main`       |
| `apply-environment`              | GitHub environment used by the apply job. Set to an empty string to disable.<br>**Default:** `production`                                                                                                                                                                                                                                                                                                                                 | No       | `production` |
| `token-broker-url`               | URL of the token broker for OIDC token exchange.<br>**Default:** Falls back to `vars.TOKEN_BROKER_URL` if not provided.                                                                                                                                                                                                                                                                                                                   | No       | _empty_      |
| `github-token-plan-scope`        | Token broker scopes for the GitHub token used by plan, whitespace-separated.<br>The token is exported as `GITHUB_TOKEN` for the OpenTofu GitHub provider.<br>**Default:** Empty, the token exchange is skipped.<br>**Example:** `contents:read administration:read`                                                                                                                                                                       | No       | _empty_      |
| `github-token-apply-scope`       | Token broker scopes for the GitHub token used by apply, whitespace-separated.<br>The token is exported as `GITHUB_TOKEN` for the OpenTofu GitHub provider.<br>**Default:** Empty, the token exchange is skipped.<br>**Example:** `contents:write administration:write`                                                                                                                                                                    | No       | _empty_      |
| `github-token-resources`         | Resources the exchanged GitHub token can access, using typed prefixes<br>(`repo:owner/name`, `org:name`, `enterprise:slug`), whitespace-separated.<br>**Default:** Empty, the token is scoped to the current repository.                                                                                                                                                                                                                  | No       | _empty_      |
| `github-token-roots`             | Roots that receive the exchanged GitHub token, one pattern per line, with the same<br>semantics as `working-directory`. Every pattern must match a root.<br>**Default:** Empty, every root receives the token.<br>**Example:** `tofu/github`                                                                                                                                                                                              | No       | _empty_      |
