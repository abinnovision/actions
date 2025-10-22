# setup-node

Setup a Node.js environment, including package mangers and private registries.
This uses the opinionated way of AB Innovision.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@setup-node-v1
        with:
          token: ${{ github.token }}
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@setup-node-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@setup-node-v1.2`: Targeting minor version <!-- x-release-please-minor -->
- `abinnovision/actions@setup-node-v1.2.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                | Description                                                                                                                                                   | Required | Default               |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------- | :-------------------- |
| `token`              | The token for the package registry. The GITHUB_TOKEN secret can be used.                                                                                      | Yes      | `${{ github.token }}` |
| `version`            | Defines a version, which overrides the default version.                                                                                                       | No       | _empty_               |
| `enable-corepack`    | If set to 'true', the corepack will be enabled.                                                                                                               | No       | `true`                |
| `enable-turbo-cache` | The following values are supported: - 'auto': Enables turbo cache if 'turbo.json' is present. - 'true': Enables turbo cache. - 'false': Disables turbo cache. | No       | `auto`                |
