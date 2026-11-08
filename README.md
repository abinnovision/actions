# evaluate-event

Evaluates the triggering event for the stack workflows. Resolves the commit to
build, the run mode and whether the run may use credentials. Fails on
pull_request_target events.

- `commit-sha` is the pull request head, the merge group head or the pushed commit, in that order.
- `mode` is `pr` for `pull_request`, `main` for a `push` to `refs/heads/<default-branch>` and
  `none` otherwise.
- `trusted` is `false` for a `pull_request` from a fork or from `dependabot[bot]`. The action then
  emits a notice that credentialed jobs are skipped.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@evaluate-event-v1
        with:
          default-branch: ${{ <default-branch> }}
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@evaluate-event-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@evaluate-event-v1.1.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input            | Description                                                         | Required | Default |
| :--------------- | :------------------------------------------------------------------ | :------- | :------ |
| `default-branch` | Default branch of the repository. A push to it runs in `main` mode. | Yes      |         |

## Outputs

| Output       | Description                                                                        |
| :----------- | :--------------------------------------------------------------------------------- |
| `commit-sha` | Commit to build: the pull request head, the merge group head or the pushed commit. |
| `mode`       | `pr` for pull requests, `main` for pushes to the default branch, otherwise `none`. |
| `trusted`    | `false` for pull requests from forks or Dependabot, otherwise `true`.              |
