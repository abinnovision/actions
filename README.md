# abinnovision/actions

This repository contains a collection of GitHub Actions as a monorepo. This repository has been designed to provide a
comprehensive set of actions that can be used to automate common development tasks and workflows. By organizing multiple
actions in a single repository, we aim to make it easier for developers to find and use the tools they need to
streamline their workflows.
Most of the actions are opinionated and are designed to work with the AB INNOVISION development workflow.

## Actions

These are the currently available actions:

- [setup-gcp](./actions/setup-gcp): Setup authentication for the Google Cloud Platform.
- [setup-node](./actions/setup-node): Set up a Node.js environment, including package mangers and private registries.
- [get-github-app-token](./actions/get-github-app-token): Gets the token for the GitHub App based on the given
  identification.
- [run-commitlint](./actions/run-commitlint): Runs [commitlint](https://commitlint.js.org/) with the default AB
  innovision config.

## Usage

All actions within this repository can be used in other repositories like this:
[//]: # "x-release-please-start-version"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@<name>-v<version>
      # E.g., abinnovision/actions@run-commitlint-v1.0.4
      # See readme of actions for configuration.
```

[//]: # "x-release-please-end"

Versioning follows the [semantic versioning](https://semver.org/) scheme. See
the [releases](https://github.com/abinnovision/actions/releases) for the latest version of each action.

The following tags are available:

- `v1`: Targeting major version
- `v1.2`: Targeting minor version
- `v1.2.3`: Targeting a patch version

## Development

Here are a few guides when working on the existing actions or creating new actions.

### Naming guideline

When deciding on the name of a new action, keep the following in mind:

- Always use _kebab-case_
- Start the name with a verb (for example _run_, _setup_, etc.)
- Keep it as short as possible
