# run-tallyrelease

(Beta) Runs the bundled tallyrelease CLI. The repository needs a tallyrelease.yaml.

This action is in beta. It bundles a fixed version of `@tallyrelease/cli`, so a CLI update is
shipped as a new release of the action.

`affected --github-output` needs the full history (`fetch-depth: 0`, optionally with
`filter: blob:none`) and the `actions: read` permission to find the last successful run as the base.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@run-tallyrelease-v0
        with:
          args: ${{ <args> }}
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@run-tallyrelease-v0`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@run-tallyrelease-v0.2.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input   | Description                                                                                                     | Required | Default               |
| :------ | :-------------------------------------------------------------------------------------------------------------- | :------- | :-------------------- |
| `args`  | CLI arguments, for example `affected --github-output`. Global flags such as `--cwd` and `--config` go here too. | Yes      |                       |
| `token` | Token exposed to the CLI as `GITHUB_TOKEN`, used to look up the last successful workflow run.                   | No       | `${{ github.token }}` |

## Outputs

| Output           | Description                                                                                                |
| :--------------- | :--------------------------------------------------------------------------------------------------------- |
| `affected`       | JSON array of affected units, each with `id`, `path` and `reason`. Only set by `affected --github-output`. |
| `affected-paths` | Newline separated paths of the affected units. Only set by `affected --github-output`.                     |
| `all`            | `true` when every unit is affected. Only set by `affected --github-output`.                                |
| `base`           | The git ref the diff was computed against. Only set by `affected --github-output`.                         |
| `base-source`    | How the base was resolved. Only set by `affected --github-output`.                                         |
