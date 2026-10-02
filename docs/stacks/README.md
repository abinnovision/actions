# Stacks

A stack is a reusable workflow that covers the whole pipeline of one kind of repository. All stacks share one job
skeleton, one trigger model and one required status check, so repository rulesets can be shared across kinds.

## Kinds

| Kind   | Stack                                                              | Repository contains                                    |
| :----- | :----------------------------------------------------------------- | :----------------------------------------------------- |
| app    | [app-monorepo-stack](../../workflows/app-monorepo-stack/README.md) | Yarn and Turbo monorepo with `apps/*` and `packages/*` |
| gitops | [gitops-stack](../../workflows/gitops-stack/README.md)             | Kubernetes manifests synced by ArgoCD                  |
| iac    | [iac-stack](../../workflows/iac-stack/README.md)                   | OpenTofu root modules with remote state                |

Planned kinds: single-package repositories (`app-standalone-stack`) and Go repositories released with goreleaser. They
follow the same contract.

## Calling a stack

Every repository calls its stack from `.github/workflows/ci.yaml`:

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
    uses: abinnovision/actions/.github/workflows/workflow.yaml@<stack>-v<major>
    permissions:
      contents: read
      # Remaining permissions are listed in the README of the stack.
```

- `pull_request_target` is rejected by every stack. Commit linting and Dependabot triage stay in a separate
  `pr-utils.yaml`, which never checks out pull request code.
- Callers must not use `paths:` filters. A workflow that does not start never reports the required check.
- Repositories with a merge queue also trigger on `merge_group`.

## Jobs

| Job         | Runs                              | Does                                                                  |
| :---------- | :-------------------------------- | :-------------------------------------------------------------------- |
| `Configure` | Always                            | Resolves the event into `mode` and `trusted`, validates the inputs    |
| `Check`     | Always                            | Repository checks and static checks of the stack, without credentials |
| Lanes       | Depending on `mode` and `trusted` | Stack specific: test, release, pack, preview, deploy, plan, apply     |
| `Status`    | Always                            | Fails when any other job failed or was cancelled                      |

- `mode` is `pr` for pull requests, `main` for pushes to the default branch and `none` otherwise.
- `trusted` is `false` for pull requests from forks and from Dependabot. Lanes that need credentials are skipped for
  untrusted runs, and `Status` stays green.

### Required status checks

Rulesets require exactly two contexts, independent of the kind:

- `CI / Status`
- `Commitlint`

### Repository checks

`Check` runs the same baseline in every stack through
[run-repo-checks](../../actions/run-repo-checks/README.md): tool setup from `.tool-versions`, `yarn install --immutable`,
`yarn dedupe --check` and `yarn check`. Every repository therefore needs a `.tool-versions` with `nodejs` and a
`check` script in its `package.json`.

## Conventions inside the workflows

- Top-level `permissions: {}` and `defaults.run.shell: bash`; every job declares its own permissions and a timeout.
- No expressions inside `run:` blocks. Values are passed through `env:`. `scripts/check-run-interpolation.ts` enforces
  this in CI.
- Step names are shared: `Checkout`, `Setup Tools`, `Install dependencies`, `Check dependencies`, `Check`, `Build`.

## Publishing

Stacks do not publish. A stack produces payloads per target format, uploads them as artifacts and exposes one release
list per target as an output. Publish workflows own the registries and their credentials, and the caller wires one job
per target. Every stack names its release-list outputs after the publish target: `npm`, `oci`, later `static`.

| Workflow                                             | Publishes                                 | Stack output | Payload artifact |
| :--------------------------------------------------- | :---------------------------------------- | :----------- | :--------------- |
| [publish-npm](../../workflows/publish-npm/README.md) | Packages to npmjs and GitHub Packages     | `npm`        | `npm-packages`   |
| [publish-oci](../../workflows/publish-oci/README.md) | Container images, then GitOps tag updates | `oci`        | `oci-context`    |

### Release list

Every publish workflow takes a `releases` input: a JSON array with one entry per released unit. An empty string or
`[]` skips the workflow.

| Field      | Required | Description                                                                           |
| :--------- | :------- | :------------------------------------------------------------------------------------ |
| `schema`   | Yes      | Protocol version, currently `1`                                                       |
| `name`     | Yes      | Unique key of the unit within the run; used for job names, secrets and GitOps lookups |
| `version`  | Yes      | Released version without build metadata                                               |
| `channel`  | Yes      | Prerelease channel, `""` for a stable release                                         |
| `sha`      | Yes      | Short commit SHA                                                                      |
| `artifact` | Yes      | Name of the artifact holding the payload                                              |
| `file`     | Yes      | File inside the artifact                                                              |
| `oci`      | No       | Target block, only read by `publish-oci`                                              |

A release is stable when `channel` is empty. The `oci` block:

| Field         | Required | Description                                                   |
| :------------ | :------- | :------------------------------------------------------------ |
| `image`       | Yes      | Image repository name, the single source for every registry   |
| `file`        | Yes      | Dockerfile path relative to the context root                  |
| `context`     | No       | Build context relative to the extracted tar root, default `.` |
| `build-args`  | No       | Object of Docker build arguments                              |
| `turbo-cache` | No       | Start the Turbo cache server for the build, default `false`   |

### Evolution

- `schema` is an integer. Adding an optional field does not change it.
- Consumers ignore fields they do not know.
- Removing or renaming a field, or changing its meaning, increments `schema` and the major version of every workflow
  involved.
- A consumer fails with a clear error on an entry whose `schema` it does not support.

### Payloads

- Payload artifacts are kept for 7 days and are only shared within one workflow run, so the stack and the publish jobs
  must run in the same caller workflow.
- A unit that fails to pack is left out of its list and fails the stack after the lists are written. Publish jobs
  therefore use `if: ${{ !cancelled() }}`, so the packed units are still published.
- `npm-packages` holds one tarball per released package, created with `yarn pack` after the released versions are
  written to the `package.json` files. `publish-npm` does not check out the repository and runs no repository code.
- `oci-context` holds `context.tar`: the tracked source tree and the `turbo prune` output of every released app.
  `publish-oci` does not check out the repository either, but the image build executes the repository's `Dockerfile`
  inside BuildKit.

A stack that emits the same release lists and artifacts can use the publish workflows without changes.
