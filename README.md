# run-workflow-dispatch

Runs a workflow on another repository. This uses the abinnovision/github-workflow-dispatch-proxy.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@run-workflow-dispatch-v1
        with:
          proxy: ${{ <proxy> }}
          target: ${{ <target> }}
          workflow: ${{ <workflow> }}
```

[//]: # "x-release-please-end"

### Example with custom inputs

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@run-workflow-dispatch-v1
        with:
          proxy: https://endpoint.com # The base URL of the proxy without a trailing slash.
          target: owner/repo # or just repo
          workflow: update.yaml # The workflow to dispatch.
          workflow-ref: master # Optional, defaults to "master".
          # Optional inputs for the workflow. Must be a valid JSON string.
          workflow-inputs: |
            {"env": "staging", "version": "..."}
```

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@run-workflow-dispatch-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@run-workflow-dispatch-v1.1.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input             | Description                                                                                                                    | Required | Default |
| :---------------- | :----------------------------------------------------------------------------------------------------------------------------- | :------- | :------ |
| `proxy`           | The URL to the github-workflow-dispatch-proxy. This is the base URL of the proxy without trailing slash.                       | Yes      |         |
| `target`          | The repository name. E.g. "repo" or "owner/repo".                                                                              | Yes      |         |
| `workflow`        | The workflow name. E.g. "update-version.yaml"                                                                                  | Yes      |         |
| `workflow-ref`    | The git reference for the workflow. The reference can be a branch or tag name.<br>By default, the "master" branch is used.<br> | No       | _empty_ |
| `workflow-inputs` | The inputs for the workflow in JSON format. E.g. '{"application": "staging", "version": "1.0.0"}'<br>                          | No       | _empty_ |
