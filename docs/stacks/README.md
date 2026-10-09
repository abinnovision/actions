# Stacks

A stack is a reusable workflow that covers the whole pipeline of one kind of repository. All stacks share one job
skeleton, one trigger model and one required status check, so repository rulesets can be shared across kinds.

## Kinds

| Kind   | Stack                                                  | Repository contains                                                                     |
| :----- | :----------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| app    | [app-stack](../../workflows/app-stack/README.md)       | Yarn and Turbo monorepo with `apps/*` and `packages/*`, or a single package at the root |
| gitops | [gitops-stack](../../workflows/gitops-stack/README.md) | Kubernetes manifests synced by ArgoCD                                                   |
| iac    | [iac-stack](../../workflows/iac-stack/README.md)       | OpenTofu root modules with remote state                                                 |

Planned kind: Go repositories released with goreleaser. It follows the same contract.

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
  group: ${{ github.workflow }}-${{ github.ref }}-${{ github.event.pull_request.number || github.event.merge_group.id || 'main' }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' || github.event_name == 'merge_group' }}

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
- Concurrency is declared in the caller only. A called workflow sees the caller's `github.workflow`, so a group on both
  sides deadlocks. Pull requests and merge groups supersede themselves; pushes to `main` are never cancelled.

## Naming

Workflows in this repository live in `workflows/<name>/workflow.yaml` and are called by the same reference everywhere,
only the tag changes:

```yaml
uses: abinnovision/actions/.github/workflows/workflow.yaml@<name>-v<major>
```

| Tag                               | Meaning                                  | Used by                                     |
| :-------------------------------- | :--------------------------------------- | :------------------------------------------ |
| `<name>-v<major>`                 | Floating major, moves with every release | Consumer repositories                       |
| `<name>-v<major>.<minor>.<patch>` | Exact pin                                | Repositories that must freeze a version     |
| `<name>-dev`                      | Tip of `main`                            | References inside this repository, rollouts |

The name tells the family of the workflow:

| Family    | Pattern                  | Examples                                 | Rule                                                                                              |
| :-------- | :----------------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------ |
| Stack     | `<kind>[-<shape>]-stack` | `app-stack`, `gitops-stack`, `iac-stack` | One per repository kind. `<shape>` only when a kind has more than one repository layout           |
| Publisher | `publish-<target>`       | `publish-oci`, `publish-npm`             | `<target>` is the artifact or registry type, not a vendor product name when a generic term exists |
| Helper    | `<kind>-<verb>-<object>` | `gitops-update-tags`                     | Dispatched by other workflows, never called from `ci.yaml`                                        |

Composite actions follow `actions/<verb>-<object>` (`run-commitlint`, `exchange-github-token`, `setup-tools`) with the
same tag scheme.

### Caller files

File names are lowercase kebab with `.yaml`; the workflow `name:` is the title-cased file name.

| File                                 | `name:`       | Triggers                                                              | Contains                                                                                           |
| :----------------------------------- | :------------ | :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yaml`          | `CI`          | `pull_request` and `push` on `main`, `merge_group` with a merge queue | Exactly one stack job plus one job per publish target                                              |
| `.github/workflows/pr-utils.yaml`    | `PR Utils`    | `pull_request`                                                        | Commit linting and Dependabot automation, never checks out pull request code                       |
| `.github/workflows/update-tags.yaml` | `Update Tags` | `workflow_dispatch`                                                   | Gitops repositories only, target of the dispatch from `publish-oci` (input `gitops-workflow-file`) |

### Caller jobs

The job `name:` of a reusable-workflow call is the prefix of every check context it produces, so job ids and names are
fixed. The workflow `name:` never appears in check contexts.

| Job            | id                 | `name:`            | Check contexts                                                                                                                                                                       |
| :------------- | :----------------- | :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack call     | `ci`               | `CI`               | `CI / Configure`, `CI / Check`, `CI / Status` and the lanes, for example `CI / Test: <type>`, `CI / Preview: <app>`, `CI / Deploy: <app>`, `CI / Plan: <root>`, `CI / Apply: <root>` |
| Publisher call | `publish-<target>` | `Publish <Target>` | `Publish OCI / Prepare`, `Publish OCI / Build: <name>`, `Publish OCI / GitOps`, `Publish npm / Publish`                                                                              |
| Commit lint    | `lint-commits`     | `Lint commits`     | `Lint commits`                                                                                                                                                                       |

- The job id is the kebab form of the job name. For publishers it equals the name of the called workflow: job
  `publish-oci` calls `publish-oci`.
- `<Target>` is written the way its ecosystem writes it: `npm`, `OCI`.
- Job names describe what is verified, not the tool that verifies it: `Check`, `Test`, `Lint commits`. Tool names
  belong in action names (`run-commitlint`, `run-release-please`). A publish target is the subject itself, so
  `Publish OCI` and `Publish npm` are fine.
- Lane names that fan out over a matrix use `<Lane>: <value>` rather than `<Lane> / <value>`, because
  GitHub renders the separator `/` as a check group. Values such as iac root paths may still contain `/`.
- Utility jobs in `pr-utils.yaml` are named verb plus subject in sentence case.
- Inputs and outputs are kebab-case (`token-broker-url`, `releases`), secrets are upper snake case
  (`APP_IMAGE_SECRETS`), placeholders use braces (`{name}`, `{path}`).

## Jobs

| Job         | Runs                              | Does                                                                                                                                                                                                                                       |
| :---------- | :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Configure` | Always                            | Resolves the event into `mode` and, for stacks with credentialed lanes, `trusted`; validates the inputs                                                                                                                                    |
| `Check`     | Always                            | Repository checks plus the static checks of the kind that need no credentials: `tofu fmt` and `validate` per root (iac), `kustomize build` with kubeconform and kube-score per application (gitops), `build`, `check` and unit tests (app) |
| Lanes       | Depending on `mode` and `trusted` | Stack specific: test, release, pack, preview, deploy, plan, apply                                                                                                                                                                          |
| `Status`    | Always                            | Fails when any other job failed or was cancelled                                                                                                                                                                                           |

- `mode` is `pr` for pull requests, `main` for pushes to the default branch and `none` otherwise.
- `trusted` is `false` for pull requests from forks and from Dependabot. Lanes that need credentials are skipped for
  untrusted runs, and `Status` stays green.

### Required status checks

Rulesets require exactly two contexts, independent of the kind:

- `CI / Status`
- `Lint commits`

### Repository checks

`Check` runs the same baseline in every stack: tool setup from `.tool-versions`, `yarn install --immutable`,
`yarn dedupe --check` and `yarn check`. `app-stack` installs through `make install-immutable` when a Makefile exists, runs
`turbo boundaries` when Turbo is a dependency and builds before `check`. Every repository therefore needs a `.tool-versions` with `nodejs` and a
`check` script in its `package.json`; app repositories also need a `build` script.

## Conventions inside the workflows

- Top-level `permissions: {}` and `defaults.run.shell: bash`; every job declares its own permissions and a timeout.
- No expressions inside `run:` blocks. Values are passed through `env:`. `scripts/check-run-interpolation.ts` enforces
  this in CI.
- Every checkout uses the commit resolved by `Configure` (`ref: needs.configure.outputs.commit-sha`) with
  `persist-credentials: false`. `Configure` uses a sparse, blob-less checkout of only what it needs and keeps the
  credentials, since `git sparse-checkout add` fetches the missing blobs on demand.
- Lanes that need credentials depend on `Check`.
- Stacks set no `concurrency`. Callers own it through the workflow-level group shown above: it cancels superseded pull
  request runs and serialises runs on the default branch; a newer pending run replaces an older pending one.
- Step names are shared: `Checkout`, `Setup Tools`, `Install dependencies`, `Check dependencies`, `Check`, `Build`.

## Releases

Stacks with a `Release` lane ([app-stack](../../workflows/app-stack/README.md)) release with
[release-please](https://github.com/googleapis/release-please) through
[run-release-please](../../actions/run-release-please/README.md). The repository needs:

- `release-please-config.json` with one package per released unit, keyed by its path (`.` for the root unit)
- `.release-please-manifest.json` with the current version of each package
- The `TOKEN_BROKER_URL` repository variable (or the `token-broker-url` input), with the token broker's GitHub App
  installed on the repository
- [Conventional Commits](https://www.conventionalcommits.org/): `fix:` bumps the patch, `feat:` the minor, `feat!:` or
  `BREAKING CHANGE` the major version

On every push to the default branch, `Release` opens or updates one release PR per package with pending changes. The push
that merges a release PR creates the GitHub releases and tags, and the released units appear in the
[release list](#release-list). Release PRs are rebuilt on every run, so manual commits on their branches are
overwritten.

### Prerelease channels

With `prerelease-channel` set (for example `beta`), every unit with pending changes is listed as a prerelease, without
merging its release PR:

| Field     | Value                                     | Example        |
| :-------- | :---------------------------------------- | :------------- |
| `version` | `{next-version}-{channel}.{commit-count}` | `1.4.0-beta.5` |
| `channel` | The channel name                          | `beta`         |
| `sha`     | Short commit SHA                          | `a3f2c1d`      |

`{commit-count}` counts the commits since the last release of the unit. Stable releases have `channel: ""`. `publish-npm`
uses the channel as the dist-tag.

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
- The pattern `.` selects the repository root. Its `name` is the repository name; publish workflows select it with
  `include: .`.
- Publish workflow input: `include`, matched against the entry `path` (default `apps/*` for publish-oci, `packages/*`
  for publish-npm).

### Payloads

| Kind   | Artifact         | File         | Contents                                                                                                                         |
| :----- | :--------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------- |
| source | `payload-source` | `source.tar` | Tracked source tree (including submodules) plus `out/<name>/` (`turbo prune --docker`) for every source unit except the root `.` |
| dist   | `payload-dist`   | `<name>.tgz` | One `yarn pack` tarball per dist unit; yarn has replaced `workspace:` ranges                                                     |

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
| `name`     | Directory basename, the repository name for the root unit `.`                                       |
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

The stack fails hard: a failing `yarn pack` or prune fails `Check`, and `Release` needs it, so
nothing is released when a payload could not be produced. A payload artifact can exist for a failed run, since uploads
overlap later steps; nothing references it. Publish jobs only need `needs: ci`: they run after a
successful stack and skip when the list is empty.

### Evolution

- `schema` is an integer. Adding an optional field does not change it.
- Consumers ignore fields they do not know.
- Removing or renaming a field, or changing its meaning, increments `schema` and the major version of every workflow
  involved.

A stack that emits the same release list and payloads can use the publish workflows without changes.
