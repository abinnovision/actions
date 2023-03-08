# abinnovision/actions

This repository contains a collection of GitHub Actions as a monorepo. This repository has been designed to provide a
comprehensive set of actions that can be used to automate common development tasks and workflows. By organizing multiple
actions in a single repository, we aim to make it easier for developers to find and use the tools they need to
streamline their workflows

## Actions

These are the currently available actions:

- [setup-gcp-authentication](./packages/setup-gcp-authentication): Setup authentication for the Google Cloud Platform.
- [setup-node](./packages/setup-node): Setup a Node.js environment, including package mangers and private registries.
- [get-github-app-token](./packages/get-github-app-token): Gets the token for the GitHub App based on the given
  identification.
- [run-commitlint](./packages/run-commitlint): Runs [commitlint](https://commitlint.js.org/) with the default AB
  innovision config.

## Usage

All actions within this repository can be used in other repositories like this:

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions/actions/<name of the action>@master
        # See readme of actions for configuration.
```

Currently, there is no proper versioning of these actions, therefore we use `master` as ref.

## Development

Here are a few guides when working on the existing actions or creating new actions.

### Naming guideline

When deciding on the name of a new action, keep the following in mind:

- Always use _kebab-case_
- Start the name with a verb (for example _run_, _setup_, etc.)
- Keep it as short as possible
