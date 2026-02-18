# abinnovision/actions

This repository contains a collection of GitHub Actions and Reusable Workflows as a monorepo. This repository has been
designed to provide a comprehensive set of actions and workflows that can be used to automate common development tasks.
By organizing multiple actions and workflows in a single repository, we aim to make it easier for developers to find and
use the tools they need to streamline their workflows.
Most of the actions and workflows are opinionated and are designed to work with the abi group development workflow.

## Actions

Browse all available actions in the [actions](./actions) directory. Each action has its own README with detailed usage
instructions.

### Usage

Actions can be used in other repositories like this:

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@<action-name>-v<version>
      # E.g., abinnovision/actions@run-commitlint-v1
      # See readme of each action for configuration.
```

## Workflows

Browse all available reusable workflows in the [workflows](./workflows) directory. Each workflow has its own README with
detailed usage instructions.

### Usage

Reusable workflows can be used in other repositories like this:

```yaml
jobs:
  <job>:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@<workflow-name>-v<version>
    # E.g., abinnovision/actions/.github/workflows/workflow.yaml@release-v1
    # See readme of each workflow for configuration.
```

## Versioning

Versioning follows the [semantic versioning](https://semver.org/) scheme. See
the [releases](https://github.com/abinnovision/actions/releases) for the latest version of each action and workflow.

The following version ranges are available:

- `<name>-v1`: Targeting major version
- `<name>-v1.2`: Targeting minor version
- `<name>-v1.2.3`: Targeting a patch version

## Development

Here are a few guides when working on the existing actions or creating new actions.

### Naming guideline

When deciding on the name of a new action, keep the following in mind:

- Always use _kebab-case_
- Start the name with a verb (for example _run_, _setup_, etc.)
- Keep it as short as possible

### Conventional commits

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.
Commit messages are validated by [commitlint](https://commitlint.js.org/) in CI. Version bumps are derived from commit
types:

| Commit type                  | Version bump |
| ---------------------------- | ------------ |
| `fix:`                       | Patch        |
| `feat:`                      | Minor        |
| `feat!:` / `BREAKING CHANGE` | Major        |

Only commits affecting files within a package's directory trigger a version bump for that package.

### Release workflow

Releases are fully automated. When changes are merged to `main`,
[release-please](https://github.com/googleapis/release-please) analyzes commit history, determines version bumps,
generates changelogs, and creates release pull requests. Merging a release PR triggers the publish pipeline.

1. CI runs checks (lint, format, build, action reference validation).
2. Release-please determines which packages have releasable changes.
3. If changes exist, release-please opens or updates a release PR with the computed version bump and changelog.
4. Merging the release PR creates GitHub releases and source tags.
5. The publish pipeline packages each released action/workflow and publishes distribution tags.
6. Dev builds are published for all packages on every push to `main`, regardless of whether a release occurred.

### Internal action references

Actions and workflows in this monorepo can reference each other. In source code, all internal references must use the
`-dev` tag:

```yaml
steps:
  - uses: abinnovision/actions@setup-tools-dev
  - uses: abinnovision/actions/.github/workflows/workflow.yaml@release-dev
```

Published packages declare their internal dependencies in `package.json` via the `actionDependencies` field:

```json
{
  "actionDependencies": {
    "release": "*",
    "setup-gcp": "*",
    "setup-tools": "*"
  }
}
```

CI validates that all internal references use `-dev` tags and that all dependencies are declared. At publish time, `-dev`
references are automatically replaced with exact version pins (e.g., `@setup-tools-dev` becomes
`@setup-tools-v1.0.0`).

### Publishing

The publish pipeline runs two phases on every push to `main`:

- **Release publishing** runs when release-please has created new releases. Each released package is packed, internal
  references are pinned to exact versions, and version tags are created (patch, minor, major).
- **Dev publishing** runs on every push. All packages are published with a `-dev` tag pointing to the latest source
  code.
