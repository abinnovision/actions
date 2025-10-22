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
