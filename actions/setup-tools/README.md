# setup-tools

Setup development tools from .tool-versions using mise.
Installs every tool listed in the file, and in mise.toml if present.
Adds extras for Node.js (corepack, yarn and Turbo caches, GitHub Packages scope),
Go (local toolchain only, module and build caches) and uv (cache).
Python implies uv.

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
- `abinnovision/actions@setup-tools-v1.2.1`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                     | Description                            | Required | Default               |
| :------------------------ | :------------------------------------- | :------- | :-------------------- |
| `tool-versions-file`      | Path to .tool-versions file            | Yes      | `.tool-versions`      |
| `node-token`              | Token for GitHub Packages registry     | No       | `${{ github.token }}` |
| `node-enable-corepack`    | Enable corepack for Node.js            | No       | `true`                |
| `node-enable-turbo-cache` | Enable Turbo cache (auto, true, false) | No       | `auto`                |
