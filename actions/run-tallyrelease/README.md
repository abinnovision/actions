# run-tallyrelease

(Beta) Runs the bundled tallyrelease CLI. The repository needs a tallyrelease.yaml.

This action is in beta. It bundles a fixed version of `@tallyrelease/cli`, so a CLI update is
shipped as a new release of the action.

`affected`, `plan`, `shadow` and `run` need the full history (`fetch-depth: 0`, optionally with
`filter: blob:none`). `affected` and `plan` on push also need the `actions: read` permission to find
the last successful run as the base.

`args` is split on whitespace. When it has several lines, every non-empty line is one argument, so
values may contain spaces. `shadow` gets `--pin <cli-version>` appended unless `--pin` is given, so
every report records the bundled version.

`affected`, `plan`, `shadow` and `run` always write their JSON document: unless `args` has `--out`,
the action adds `--out $RUNNER_TEMP/tallyrelease-<command>.json`. The `result` output holds the
document and `result-file` its path, also when the command fails after writing it (for example `shadow --strict`).
Other commands set neither. The documents follow the published schemas
[`affected.schema.json`](https://cdn.jsdelivr.net/npm/@tallyrelease/cli@0/dist/affected.schema.json) and
[`plan.schema.json`](https://cdn.jsdelivr.net/npm/@tallyrelease/cli@0/dist/plan.schema.json).

```yaml
jobs:
  affected:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      actions: read
    outputs:
      units: ${{ toJSON(fromJSON(steps.tr.outputs.result).units) }}
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
          filter: blob:none
      - id: tr
        uses: abinnovision/actions@run-tallyrelease-v0 # x-release-please-major
        with:
          args: affected

  build:
    needs: affected
    if: needs.affected.outputs.units != '[]'
    strategy:
      matrix:
        unit: ${{ fromJSON(needs.affected.outputs.units) }}
    runs-on: ubuntu-latest
    steps:
      - run: echo "build ${{ matrix.unit.id }} from ${{ matrix.unit.path }}"
```

`run --dry-run` computes the release PRs, tags and forge releases a release would create without
changing the repository or the forge. It reads release PRs, tags, merged pull requests and the last successful run through
`token`, which needs read access to `contents`, `issues`, `pull_requests` and `actions`:

```yaml
- uses: actions/checkout@v6
  with:
    fetch-depth: 0
    filter: blob:none
- uses: abinnovision/actions@run-tallyrelease-v0 # x-release-please-major
  with:
    args: |
      run
      --branch
      main
      --dry-run
      --summary
```

A step output is limited to about 1 MB. For large repositories read `result-file` instead, or upload
it with `actions/upload-artifact`. Keys written by the CLI's own `--github-output` still appear as
step outputs, but they are not part of this action's contract.

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
- `abinnovision/actions@run-tallyrelease-v0.4.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input   | Description                                                                                                                                                                                                                                                  | Required | Default               |
| :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :-------------------- |
| `args`  | CLI arguments, for example `affected --github-output`. Split on whitespace, or one argument per line when the value has several lines. Global flags such as `--cwd` and `--config` go here too. `shadow` gets `--pin <cli-version>` unless `--pin` is given. | Yes      |                       |
| `token` | Token exposed to the CLI as `GITHUB_TOKEN`, used to look up the last successful workflow run, and by `run` for release PRs and tags. `run --dry-run` needs read access to contents, issues, pull requests and actions.                                       | No       | `${{ github.token }}` |

## Outputs

| Output        | Description                                                                                                                                        |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| `result`      | The JSON document of `affected`, `plan`, `shadow` or `run`, as written by `--out`. Not set for other commands.                                     |
| `result-file` | Path of the JSON document of `affected`, `plan`, `shadow` or `run`. `--out` is added under `RUNNER_TEMP` unless given. Not set for other commands. |
| `cli-version` | Version of the bundled `@tallyrelease/cli`.                                                                                                        |
