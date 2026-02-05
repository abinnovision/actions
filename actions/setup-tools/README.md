# setup-tools

Setup development tools from .tool-versions using native GitHub Actions.
Automatically installs all tools defined in the file.
Supports Node.js (with corepack), Python (with uv), and Go.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@setup-tools-v1
        with:
          tool-versions-file: .tool-versions
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@setup-tools-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@setup-tools-v0.0`: Targeting minor version <!-- x-release-please-minor -->
- `abinnovision/actions@setup-tools-v1.0.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                     | Description                            | Required | Default               |
| :------------------------ | :------------------------------------- | :------- | :-------------------- |
| `tool-versions-file`      | Path to .tool-versions file            | Yes      | `.tool-versions`      |
| `node-token`              | Token for GitHub Packages registry     | No       | `${{ github.token }}` |
| `node-enable-corepack`    | Enable corepack for Node.js            | No       | `true`                |
| `node-enable-turbo-cache` | Enable Turbo cache (auto, true, false) | No       | `auto`                |
