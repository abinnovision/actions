# Release Workflow

This document describes the release principles and workflow for the `abinnovision/actions` monorepo.

## Overview

Releases are fully automated and driven by conventional commits. When changes are merged to
`main`, [release-please](https://github.com/googleapis/release-please) analyzes commit history,
determines version bumps, generates changelogs, and creates release pull requests. Merging a
release PR triggers the publish pipeline, which distributes each package as independently
consumable GitHub Actions or Reusable Workflows.

Each package in the monorepo is versioned independently and follows [semantic versioning](https://semver.org/).

## Conventional Commits

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/)
specification. Commit messages are validated by [commitlint](https://commitlint.js.org/) in CI.

Version bumps are derived from commit types:

| Commit type              | Version bump |
| ------------------------ | ------------ |
| `fix:`                   | Patch        |
| `feat:`                  | Minor        |
| `feat!:` / `BREAKING CHANGE` | Major        |

Only commits affecting files within a package's directory trigger a version bump for that package.

## Release Lifecycle

```
Merge to main
    │
    ▼
Build & Validate (lint, format, build, check action references)
    │
    ▼
Release-Please analyzes commits
    ├─ Changes detected     → Creates/updates release PR (version bump + changelog)
    └─ No changes           → No action
    │
    ▼
Release PR merged
    │
    ▼
Publish Pipeline
    ├─ Phase 1: Release Publishing (versioned packages)
    └─ Phase 2: Dev Publishing (all packages)
```

### Step by step

1. A developer merges a pull request into `main`.
2. The CI pipeline runs checks (lint, format, build, action reference validation).
3. Release-please determines which packages have releasable changes based on conventional commits.
4. If changes exist, release-please opens or updates a release PR per package with the computed
   version bump and generated changelog entry.
5. When a release PR is merged, release-please creates GitHub releases and source tags.
6. The publish pipeline packages each released action/workflow, resolves internal references
   to exact versions, and publishes distribution tags.
7. Dev builds are published for all packages on every push to `main`, regardless of whether
   a release occurred.

## Package Structure

The monorepo contains two categories of packages:

```
actions/
  get-github-app-token/    # Composite actions
  run-commitlint/
  run-release-please/
  setup-gcp/
  setup-node/
  setup-tools/
  run-workflow-dispatch/

workflows/
  release/                 # Reusable workflows
  node-monorepo-stack/
  gitops-deploy/
  gitops-update-tags/
  polyglot-monorepo-stack/
```

**Actions** are composite GitHub Actions distributed as standalone repositories. Each contains
an `action.yml` and optionally a `dist/` directory with bundled code.

**Workflows** are reusable GitHub Actions workflows. Each contains a `workflow.yaml` that is
published under `.github/workflows/workflow.yaml` in its distribution branch.

All packages are managed as Yarn workspaces and registered in `release-please-config.json`
with their versions tracked in `.release-please-manifest.json`.

## Version Tagging

Each published package receives multiple tags to allow consumers to choose their desired
stability level:

| Tag format             | Example                | Stability                         |
| ---------------------- | ---------------------- | --------------------------------- |
| `<name>-v<major>.<minor>.<patch>` | `setup-node-v1.2.0` | Exact version, fully pinned       |
| `<name>-v<major>.<minor>`         | `setup-node-v1.2`   | Receives patch updates            |
| `<name>-v<major>`                 | `setup-node-v1`      | Receives minor and patch updates  |
| `<name>-dev`                      | `setup-node-dev`     | Latest from `main`, not versioned |

Major and minor tags are moved forward on each release. Dev tags are updated on every push
to `main`.

Additionally, release-please creates **source tags** in the format `<name>-source-v<version>`
(e.g., `setup-node-source-v1.2.0`) to track releases within the monorepo's commit history.

## Inter-Repo Version Linking

Actions and workflows within this monorepo can reference each other. To manage these internal
references safely, the system uses a two-phase approach.

### Development: `-dev` references

In source code, all internal references use the `-dev` tag:

```yaml
# In workflows/polyglot-monorepo-stack/workflow.yaml
steps:
  - uses: abinnovision/actions@setup-tools-dev
  - uses: abinnovision/actions@setup-gcp-dev
  - uses: abinnovision/actions/.github/workflows/workflow.yaml@release-dev
```

This ensures development and CI always use the latest version of each dependency.

### Dependency declaration: `actionDependencies`

Published packages declare their internal dependencies in `package.json`:

```json
{
  "name": "polyglot-monorepo-stack",
  "actionDependencies": {
    "release": "*",
    "run-workflow-dispatch": "*",
    "setup-gcp": "*",
    "setup-tools": "*"
  }
}
```

### Validation

The `check-action-refs` script runs in CI and enforces two rules:

1. All internal action references in source must use `-dev` tags (never pinned versions).
2. Published packages must declare all internal dependencies in `actionDependencies`.

### Resolution at publish time

When a package is released, the `resolve-action-refs` script replaces `-dev` references with
exact version pins based on the current workspace versions:

```
@setup-tools-dev  →  @setup-tools-v1.0.0
@setup-gcp-dev    →  @setup-gcp-v1.1.1
@release-dev      →  @release-v2.0.0
```

This guarantees that published distributions reference specific, tested versions of their
dependencies.

## Two-Phase Publishing

The publish pipeline runs two phases on every push to `main`.

### Phase 1: Release Publishing

Runs only when release-please has created new releases. For each released package:

1. Packs the package with `yarn pack`.
2. Creates a staging directory and unpacks the archive.
3. For workflows, restructures the layout so `workflow.yaml` is at `.github/workflows/workflow.yaml`.
4. Runs `resolve-action-refs` to pin internal `-dev` references to exact versions.
5. Initializes a git repository on a versioned branch (e.g., `action/setup-node/v1.2.0`).
6. Creates and pushes version tags (patch, minor, major).

### Phase 2: Dev Publishing

Runs on every push, regardless of whether releases were created. For every package:

1. Packs and stages the package (same as Phase 1).
2. Publishes to a dev branch (e.g., `action/setup-node/dev`).
3. Creates and pushes the `-dev` tag.

Dev references are **not** version-pinned. They always point to the latest source code,
which enables continuous integration across packages.

## Consumer Usage

### Actions

```yaml
jobs:
  build:
    steps:
      - uses: abinnovision/actions@setup-node-v1
```

### Reusable Workflows

```yaml
jobs:
  release:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@release-v2
```

Use the major version tag (e.g., `@setup-node-v1`) for automatic minor and patch updates.
Use a more specific tag (e.g., `@setup-node-v1.2.0`) when exact version pinning is required.
