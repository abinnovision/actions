# run-workflow-dispatch

This action dispatches a workflow on another repository based on the given
configuration.

## Usage

[//]: # "x-release-please-start-major"

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

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@run-workflow-dispatch-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@run-workflow-dispatch-v1.0`: Targeting minor version <!-- x-release-please-minor -->
- `abinnovision/actions@run-workflow-dispatch-v1.0.5`: Targeting a patch version <!-- x-release-please-version -->
