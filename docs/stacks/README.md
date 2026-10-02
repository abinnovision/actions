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

| Job         | Runs                              | Does                                                                        |
| :---------- | :-------------------------------- | :-------------------------------------------------------------------------- |
| `Configure` | Always                            | Resolves the event into `mode` and `trusted`, validates the inputs          |
| `Check`     | Always                            | Repository checks and static checks of the stack, without credentials       |
| Lanes       | Depending on `mode` and `trusted` | Stack specific: test, release, pack, releases, preview, deploy, plan, apply |
| `Status`    | Always                            | Fails when any other job failed or was cancelled                            |

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

Stacks do generic work only (prune, build, pack) and know no publish target. They upload payload artifacts and expose
one release list as the `releases` output. Publish workflows own the registries and their credentials and do the
target-specific last step without installing or building. The caller wires one job per publish workflow and passes the
same `releases` value to each.

### Units and patterns

A unit is a directory that contains a `package.json`. Units are selected by directory patterns, one per line (blank
lines ignored), where `*` matches exactly one path segment and never `/`: `apps/*` matches `apps/web` but not
`apps/web/admin`. Stacks and publish workflows use the same semantics.

- Stack inputs: `source-units` (default `apps/*`) and `dist-units` (default `packages/*`).
- Publish workflow input: `include`, matched against the entry `path` (default `apps/*` for publish-oci, `packages/*`
  for publish-npm).

### Payloads

| Kind   | Artifact         | File         | Contents                                                                                                     |
| :----- | :--------------- | :----------- | :----------------------------------------------------------------------------------------------------------- |
| source | `payload-source` | `source.tar` | Tracked source tree (including submodules) plus `out/<name>/` (`turbo prune --docker`) for every source unit |
| dist   | `payload-dist`   | `<name>.tgz` | One `yarn pack` tarball per dist unit; yarn has replaced `workspace:` ranges                                 |

`<name>` is the directory basename; the stack rejects duplicate basenames within the source units or within the dist
units. Payloads are version-free and kept for 7 days. Artifacts are only shared within one workflow run, so the stack
and the publish jobs must run in the same caller workflow.

### Release list

`releases` is a JSON array with one entry per released unit, `[]` when nothing was released:

```json
{
  "schema": 1,
  "name": "backend",
  "path": "apps/backend",
  "version": "1.4.0-beta.5",
  "channel": "beta",
  "sha": "a3f2c1d",
  "payloads": {
    "source": { "artifact": "payload-source", "file": "source.tar" },
    "dist": { "artifact": "payload-dist", "file": "backend.tgz" }
  }
}
```

| Field      | Description                                                                                         |
| :--------- | :-------------------------------------------------------------------------------------------------- |
| `schema`   | Protocol version, currently `1`                                                                     |
| `name`     | Directory basename                                                                                  |
| `path`     | Unit path in the repository, the unique key                                                         |
| `version`  | Released version without build metadata                                                             |
| `channel`  | Prerelease channel, `""` for a stable release                                                       |
| `sha`      | Short commit SHA                                                                                    |
| `payloads` | Payloads that exist for the unit, may be `{}`: `source` and `dist`, each with `artifact` and `file` |

Every released unit is listed. A unit gets `payloads.source` when it is a source unit and `payloads.dist` when it is a
dist unit.

### Publish workflows

| Workflow                                             | Publishes                                 | Default `include` | Consumes          |
| :--------------------------------------------------- | :---------------------------------------- | :---------------- | :---------------- |
| [publish-oci](../../workflows/publish-oci/README.md) | Container images, then GitOps tag updates | `apps/*`          | `payloads.source` |
| [publish-npm](../../workflows/publish-npm/README.md) | Packages to npmjs and GitHub Packages     | `packages/*`      | `payloads.dist`   |

- An empty string or `[]` means nothing to do; the workflow skips without failing.
- Entries whose `path` matches `include` are selected; all other entries are ignored silently.
- A selected entry with `schema != 1` or without the consumed payload fails with an error naming the entry. Nothing
  else is validated: the list comes from the caller's own stack in the same run.

### Failure model

The stack fails hard: a failing `yarn pack` fails `Check`, a failing prune fails `Pack`, and `Release` needs both, so
nothing is released when a payload could not be produced. Publish jobs only need `needs: ci`: they run after a
successful stack and skip when the list is empty.

### Evolution

- `schema` is an integer. Adding an optional field does not change it.
- Consumers ignore fields they do not know.
- Removing or renaming a field, or changing its meaning, increments `schema` and the major version of every workflow
  involved.

A stack that emits the same release list and payloads can use the publish workflows without changes.
