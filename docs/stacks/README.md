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
| Publisher call | `publish-<target>` | `Publish <Target>` | `Publish OCI / Prepare`, `Publish OCI / Build: <id>`, `Publish OCI / GitOps`, `Publish npm / Publish`, `Publish Linear / Sync: <ids> v<version>`                                     |
| Commit lint    | `lint-commits`     | `Lint commits`     | `Lint commits`                                                                                                                                                                       |

- The job id is the kebab form of the job name. For publishers it equals the name of the called workflow: job
  `publish-oci` calls `publish-oci`.
- `<Target>` is written the way its ecosystem writes it: `npm`, `OCI`.
- Job names describe what is verified, not the tool that verifies it: `Check`, `Test`, `Lint commits`. Tool names
  belong in action names (`run-commitlint`, `run-tallyrelease`). A publish target is the subject itself, so
  `Publish OCI` and `Publish npm` are fine.
- Lane names that fan out over a matrix use `<Lane>: <value>` rather than `<Lane> / <value>`, because
  GitHub renders the separator `/` as a check group. Values such as iac root paths may still contain `/`.
- Utility jobs in `pr-utils.yaml` are named verb plus subject in sentence case.
- Inputs and outputs are kebab-case (`token-broker-url`, `releases`), secrets are upper snake case
  (`APP_IMAGE_SECRETS`), placeholders use braces (`{id}`, `{path}`).

## Jobs

| Job         | Runs                              | Does                                                                                                                                                                                                                                                        |
| :---------- | :-------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Configure` | Always                            | Resolves the event into `mode` and, for stacks with credentialed lanes, `trusted`; validates the inputs                                                                                                                                                     |
| `Check`     | Always                            | Repository checks plus the static checks of the kind that need no credentials: `tofu fmt`, `validate` and optional `test` per root (iac), `kustomize build` with kubeconform and kube-score per application (gitops), `build`, `check` and unit tests (app) |
| Lanes       | Depending on `mode` and `trusted` | Stack specific: test, release, pack, preview, deploy, plan, apply                                                                                                                                                                                           |
| `Status`    | Always                            | Fails when any other job failed or was cancelled                                                                                                                                                                                                            |

- `mode` is `pr` for pull requests, `main` for pushes to the default branch and `none` otherwise. In app-stack every
  branch push is `main` and releases for that branch, and `pr` plans the releases of the base branch.
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
  `persist-credentials: false`; only `Release build` checks out the release commit it builds. `Configure` uses a
  blob-less checkout and keeps the credentials, since the missing blobs are fetched on demand: a sparse checkout of only
  what it needs in gitops-stack and iac-stack, one checkout with the full history for tallyrelease in app-stack.
- Lanes that need credentials depend on `Check`.
- Stacks set no `concurrency`. Callers own it through the workflow-level group shown above: it cancels superseded pull
  request runs and serialises runs on the default branch; a newer pending run replaces an older pending one.
- Step names are shared: `Checkout`, `Setup Tools`, `Install dependencies`, `Check dependencies`, `Check`, `Build`.

## Releases

Stacks with a `Release` lane ([app-stack](../../workflows/app-stack/README.md#releases)) release with
[tallyrelease](https://github.com/abinnovision/tallyrelease) through
[run-tallyrelease](../../actions/run-tallyrelease/README.md). The repository needs:

- `tallyrelease.yaml` with the released units and their tags, usually as glob overlays such as
  `"apps/*": { release: true, tags: [source] }`; globs never match the root unit, so `"."` is listed explicitly.
  Channels and maintenance lines are branch rules in the same file
- The `TOKEN_BROKER_URL` repository variable (or the `token-broker-url` input), with the token broker's GitHub App
  installed on the repository
- [Conventional Commits](https://www.conventionalcommits.org/): `fix:` bumps the patch, `feat:` the minor, `feat!:` or
  `BREAKING CHANGE` the major version

Every branch push runs `tallyrelease run --branch <branch>` with a token broker token
(`contents:write pull_requests:write issues:read actions:read`). It tags merged release PRs, creates the GitHub
releases and updates the release PRs; the releases appear in the [release list](#release-list). Pull requests run
`tallyrelease plan` for their base branch and change nothing.

- A branch rule with a `channel` lists the units with pending changes as prereleases of that channel, without merging
  their release PR
- A release whose run was cancelled or failed is listed again by the next run as a catch-up (`catchUp: true`), as is a
  release of a unit outside the build set. One `Release build` job per release commit builds their payloads
- Maintenance lines (`line: maintenance` branch rules) release through the stack once the caller adds their patterns,
  such as `release/**`, to its `push` and `pull_request` triggers. Their releases have `latest: false`, so they get no
  `latest` tag and no GitOps dispatch
- The caller must declare the workflow-level concurrency group shown above. tallyrelease uses the labels
  `tallyrelease: pending`, `tallyrelease: released` and `tallyrelease: stale` and creates them when they are missing;
  creating them up front is recommended

### Migrating from release-please

- Delete `release-please-config.json` and `.release-please-manifest.json`
- Set `tagFormat` in `tallyrelease.yaml` so it matches the existing tags
- Close the open release-please PRs
- Add `id:` where two units share a basename
- Move the unit patterns of the stack and the publishers into `tallyrelease.yaml` as `source` and `dist` tags
- Update the stack and every publisher to v2 together: v2 publishers fail on a v1 release list, and v1 publishers cannot
  read a v2 one

## Publishing

Stacks do generic work only (prune, build, pack) and know no publish target. They upload payload artifacts and expose
one release list as the `releases` output. Publish workflows own the registries and their credentials and do the
target-specific last step without installing or building. The caller wires one job per publish workflow and passes the
same `releases` value to each.

### Units and patterns

A unit is a directory that contains a `package.json`. Units, their ids and their tags come from `tallyrelease.yaml`. A
key with `*` is a glob over unit roots, where `*` matches exactly one path segment and never `/`: `apps/*` matches
`apps/web` but not `apps/web/admin`. `*` skips dot directories such as `apps/.cache`.

- The tags decide the payload: `source` units are pruned into the source payload, `dist` units are packed into the
  dist payload.
- Publish workflows select entries by tag or kind and have no `include` input: publish-oci the entries tagged
  `source`, publish-npm those tagged `dist`, publish-linear those with `kind: release`.
- `id` is the unit id: the directory basename, the repository name for the root unit `.`, or the `id:` set in
  `tallyrelease.yaml`. It is the key of `gitops-routes` and `APP_IMAGE_SECRETS` (publish-oci) and of
  `LINEAR_ACCESS_KEYS`, where the fixed `group` of an entry takes precedence (`group // id`).

### Payloads

| Tag    | Artifact                                                       | File         | Contents                                                                                                                       |
| :----- | :------------------------------------------------------------- | :----------- | :----------------------------------------------------------------------------------------------------------------------------- |
| source | `payload-source`, or `payload-source-<releaseSha>` on catch-up | `source.tar` | Tracked source tree (including submodules) plus `out/<id>/` (`turbo prune --docker`) for every source unit except the root `.` |
| dist   | `payload-dist`, or `payload-dist-<releaseSha>` on catch-up     | `<id>.tgz`   | One `yarn pack` tarball per dist unit; yarn has replaced `workspace:` ranges                                                   |

`<releaseSha>` is the full SHA of the entry and is appended when `catchUp` is `true`. Publishers derive the artifact
from each entry by this rule. `<id>` is unique, since tallyrelease fails with `E_DUPLICATE_UNIT` when two units share
one. Payloads are version-free and kept for 7 days. Artifacts are only shared within one workflow run, so the stack and
the publish jobs must run in the same caller workflow.

### Release list

`releases` (release list v2) is a JSON array with one entry per release, `[]` when nothing was released. The entries
are the release entries of `tallyrelease run`, without `changes` and with `prs`:

```json
{
  "id": "backend",
  "path": "apps/backend",
  "kind": "release",
  "version": "1.4.0",
  "channel": null,
  "tag": "backend-v1.4.0",
  "releaseSha": "a3f2c1d9e8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3",
  "catchUp": false,
  "forge": {
    "pr": { "number": 42, "url": "https://github.com/acme/app/pull/42" },
    "release": {
      "url": "https://github.com/acme/app/releases/tag/backend-v1.4.0"
    }
  },
  "latest": true,
  "tags": ["source"],
  "group": null,
  "prs": [38, 41]
}
```

| Field        | Description                                                                                                                           |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `id`         | Unit id, see [Units and patterns](#units-and-patterns)                                                                                |
| `path`       | Unit root in the repository                                                                                                           |
| `kind`       | `release` or `prerelease`                                                                                                             |
| `version`    | Released version, or the prerelease version of the plan                                                                               |
| `channel`    | Channel of the line for a prerelease, `null` for a release                                                                            |
| `tag`        | Version tag of a release, `null` for a prerelease                                                                                     |
| `releaseSha` | Full SHA of the tagged release commit, or the commit of the run for a prerelease                                                      |
| `catchUp`    | `true` for a release not built from the commit of the run: its commit is another one, or its unit is outside the build set            |
| `forge`      | `{ pr, release }`, `null` for a prerelease: `pr` is `{ number, url }` of the merging PR, `release` is `{ url }` of the GitHub release |
| `latest`     | `true` for the unit's highest stable tag, never on a maintenance line, `false` for a prerelease                                       |
| `tags`       | The unit's tags, sorted                                                                                                               |
| `group`      | Name of the unit's fixed group, else `null`                                                                                           |
| `prs`        | Pull request numbers of the release's changes, including those of the units it was propagated from                                    |

Stable releases come first, oldest release commit first, then the prereleases. The fields are described in the
[CLI README](https://github.com/abinnovision/tallyrelease/blob/main/packages/cli/README.md#releases-in-ci). `changes`
is dropped because the list travels through `env:` in every publisher, which caps a variable at 128 KiB.

Every publisher follows the same rules:

| Concern     | Rule                                                                                                                                                                                                                                                                                                                                  |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entry check | Every entry must have `latest`, checked before any selection; the error names the entry. A v1 list fails here                                                                                                                                                                                                                         |
| Selection   | publish-oci: `tags` contains `source`. publish-npm: `tags` contains `dist`. publish-linear: `kind == "release"`. Other entries are ignored silently                                                                                                                                                                                   |
| Payload     | Artifact `payload-source` or `payload-dist`, with `-<releaseSha>` appended when `catchUp`; file `source.tar` or `<id>.tgz`                                                                                                                                                                                                            |
| Kind        | Branch on `kind`, never on `channel`. The commit is `releaseSha`                                                                                                                                                                                                                                                                      |
| Line        | Entries carry no line. The run is on the default line when `github.ref_name == github.event.repository.default_branch`                                                                                                                                                                                                                |
| Latest      | `latest` of the entry. Re-run guard: on a run attempt after the first, when the branch tip is not the commit of the run or cannot be read, every entry counts as `latest: false` and nothing is dispatched (warning). The guard runs in every job that can be re-run on its own, since "Re-run failed jobs" does not re-run `Prepare` |
| Dispatch    | publish-oci dispatches GitOps for `latest \|\| (kind == "prerelease" && default line)`                                                                                                                                                                                                                                                |
| CSV keys    | The first column of `gitops-routes`, `APP_IMAGE_SECRETS` and `LINEAR_ACCESS_KEYS` is the unit `id`; Linear uses `group // id`                                                                                                                                                                                                         |

### Publish workflows

| Workflow                                                   | Publishes                                 | Selects                      | Consumes         |
| :--------------------------------------------------------- | :---------------------------------------- | :--------------------------- | :--------------- |
| [publish-oci](../../workflows/publish-oci/README.md)       | Container images, then GitOps tag updates | Entries tagged `source`      | `source` payload |
| [publish-npm](../../workflows/publish-npm/README.md)       | Packages to npmjs and GitHub Packages     | Entries tagged `dist`        | `dist` payload   |
| [publish-linear](../../workflows/publish-linear/README.md) | Stable releases to Linear Releases        | Entries with `kind: release` | `prs`            |

- An empty string or `[]` means nothing to do; the workflow skips without failing.
- A list that fails the entry check, or a selected entry whose payload is missing, fails with an error naming the
  entry. Nothing else is validated: the list comes from the caller's own stack in the same run.

### Failure model

The stack fails hard: a failing `yarn pack` or prune fails `Check`, and `Release` needs it, so
nothing is released when a payload could not be produced. A failed `Release build` fails the `ci` job, so the publish
jobs are skipped for that run and the next run lists those releases again. A payload artifact can exist for a failed
run, since uploads overlap later steps; nothing references it. Publish jobs only need `needs: ci`: they run after a
successful stack and skip when the list is empty.

### Evolution

- Within a major, entries only gain fields, as in tallyrelease.
- Consumers ignore fields they do not know.
- Removing a field or changing its meaning is a major version of tallyrelease and of every workflow involved.

A stack that emits the same release list and payloads can use the publish workflows without changes.
