# triage-dependabot-pr

Automatically approve and enable auto-merge for Dependabot pull requests.
By default, all update types (major, minor, patch) are auto-approved and
auto-merged via squash.

Triages Dependabot pull requests by automatically enabling auto-merge and
approving dependency updates. The action validates its context on entry and
skips gracefully when the actor is not `dependabot[bot]`.

## Usage

```yaml
on:
  pull_request:
    branches: [main]

jobs:
  dependabot:
    name: Dependabot automations
    runs-on: ubuntu-latest
    if: ${{ github.actor == 'dependabot[bot]' }}
    permissions:
      pull-requests: write
      contents: write
    steps:
      - uses: actions/checkout@v6
      - uses: abinnovision/actions@triage-dependabot-pr-v1
```

> **Note:** The `if` condition is optional. The action includes a built-in
> gate that skips execution when the actor is not `dependabot[bot]`. Adding
> the `if` avoids spinning up the job entirely.

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@triage-dependabot-pr-v0`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@triage-dependabot-pr-v0.0.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                  | Description                                                                                                                                                     | Required | Default               |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :-------------------- |
| `token`                | GitHub token with pull-requests:write and contents:write permissions.<br>                                                                                       | No       | `${{ github.token }}` |
| `approve-update-types` | Space-separated list of semver update types to auto-approve.<br>Supported values: major, minor, patch.<br>Auto-merge is enabled regardless of this setting.<br> | No       | `major minor patch`   |
| `auto-merge`           | Whether to enable auto-merge on the PR.<br>                                                                                                                     | No       | `true`                |
| `merge-method`         | Merge method to use. One of: squash, merge, rebase.<br>                                                                                                         | No       | `squash`              |

## Outputs

| Output        | Description                                                   |
| :------------ | :------------------------------------------------------------ |
| `update-type` | The semver update type detected by dependabot/fetch-metadata. |
| `approved`    | Whether the PR was approved by this action.                   |
