# setup-oidc-token-cli

Installs the abinnovision/oidc-token-cli binary with GitHub Actions tool
caching. Defaults to the latest release, so no inputs are required; pass a
bare semver to pin a specific version.

Installs [`abinnovision/oidc-token-cli`](https://github.com/abinnovision/oidc-token-cli) from its
GitHub releases with GitHub Actions tool caching. The `version` input accepts `"latest"` to resolve
and install the newest release at runtime, or a pinned bare semver string (e.g. `"0.7.0"`) for
reproducible builds. It defaults to `"latest"`, so the action can be used without any inputs. The
resolved version is written to the `version` output and used as the tool-cache key, so re-runs on the
same runner skip redundant downloads.

The installed binary is named `oidc-token` (invoke it as `oidc-token`, not `oidc-token-cli`).

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@setup-oidc-token-cli-v1
        with:
          github-token: ${{ github.token }}
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@setup-oidc-token-cli-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@setup-oidc-token-cli-v1.0.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input          | Description                                                     | Required | Default               |
| :------------- | :-------------------------------------------------------------- | :------- | :-------------------- |
| `github-token` | GitHub token for authenticated API and asset download requests. | Yes      | `${{ github.token }}` |
| `version`      | Version to install ("latest" or e.g. "0.7.0").                  | No       | `latest`              |

## Outputs

| Output    | Description                                              |
| :-------- | :------------------------------------------------------- |
| `version` | Resolved oidc-token-cli version installed (bare semver). |

The `version` output is the resolved bare semver (e.g. `0.7.0`, without a `v` prefix).
