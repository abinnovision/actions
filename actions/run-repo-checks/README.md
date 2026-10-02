# run-repo-checks

Runs the repository baseline checks: sets up the tools from .tool-versions,
installs dependencies, verifies the lockfile is deduplicated and runs the check command.
The repository must already be checked out.

## Steps

1. `Setup Tools`: installs the tools from `.tool-versions` with [setup-tools](../setup-tools/README.md)
2. `Install dependencies`: runs `install-command`
3. `Check dependencies`: runs `yarn dedupe --check`
4. `Check`: runs `check-command`

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@run-repo-checks-v0
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@run-repo-checks-v0`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@run-repo-checks-v0.0.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input             | Description                          | Required | Default                    |
| :---------------- | :----------------------------------- | :------- | :------------------------- |
| `install-command` | Command to install dependencies      | No       | `yarn install --immutable` |
| `check-command`   | Command to run the repository checks | No       | `yarn check`               |
