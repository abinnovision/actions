# setup-tools

Setup development tools from the mise config (mise.toml, .tool-versions and the other files mise reads).
Installs every tool the config declares.
Adds extras for Node.js (corepack when packageManager is set, yarn and Turbo caches,
GitHub Packages scope), Go (local toolchain only, module and build caches) and uv (cache).
Python implies uv.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@setup-tools-v2
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@setup-tools-v2`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@setup-tools-v2.1.0`: Targeting a patch version <!-- x-release-please-version -->

## Configuration

mise discovers the config in the directory of `tool-versions-file` and its parents: `mise.toml`, `.mise.toml`,
`mise.<env>.toml`, `.config/mise.toml`, `.config/mise/config.toml`, `mise/config.toml`, `.mise/config.toml`, `mise.lock`
and `.tool-versions`. The file named by `tool-versions-file` does not have to exist.

- `python` implies `uv` unless the config pins it. The implied `uv` is not listed in the `versions` output.
- The mise cache is saved after the job, so tools installed by later steps are cached too.
- See the [mise-action README](https://github.com/jdx/mise-action#readme) for `--locked` installs and `[env]` export.

## Inputs

| Input                | Description                                                                                        | Required | Default               |
| :------------------- | :------------------------------------------------------------------------------------------------- | :------- | :-------------------- |
| `tool-versions-file` | Path to .tool-versions; its directory is where mise looks for config. The file itself is optional. | No       | `.tool-versions`      |
| `node-token`         | Token for the GitHub Packages registry (used when Node.js is installed)                            | No       | `${{ github.token }}` |
