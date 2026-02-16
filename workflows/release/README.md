# release

Automate releases using release-please with GitHub App authentication and optional GCP setup.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  release:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@release-v1
    secrets:
      GH_APP_IDENTIFICATION_RELEASER: ${{ secrets.GH_APP_IDENTIFICATION_RELEASER }}
    # Or to inherit the secrets from the caller:
    secrets: inherit
```

[//]: # "x-release-please-end"

## Latest versions

This workflow can be used with different version ranges. The following ranges are available:

- `abinnovision/actions/.github/workflows/workflow.yaml@release-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions/.github/workflows/workflow.yaml@release-v1.0.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                | Description                                                                                                                                                                                                                          | Required | Default                |
| :------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :--------------------- |
| `gcp-auth`           |                                                                                                                                                                                                                                      | No       | `${{ vars.GCP_AUTH }}` |
| `target-branch`      | Branch to release from. Defaults to the repository default branch.                                                                                                                                                                   | No       | _empty_                |
| `prerelease-channel` | Prerelease channel name (e.g., "beta", "canary", "rc").<br>When set, computes prerelease versions for packages with pending changes.<br>Format: {next-version}-{channel}.{commit-count}+{short-sha}<br>Example: 1.4.0-beta.5+a3f2c1d | No       | _empty_                |

## Secrets

| Secret                           | Description | Required |
| :------------------------------- | :---------- | :------- |
| `GH_APP_IDENTIFICATION_RELEASER` |             | Yes      |

## Outputs

| Output             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `releases-created` | If any releases have been created. This is a boolean value, either "true" or "false".                                                                                                                                                                                                                                                                                                                                                                   |
| `versions`         | JSON object mapping released package paths to version info.<br>Each entry contains "version" (semver) and "tag" (docker-compatible).<br>Populated for both stable releases and prereleases.<br>Empty object {} when nothing was released or computed.<br>Stable example: {"actions/setup-node": {"version": "1.2.0", "tag": "1.2.0"}}<br>Prerelease example: {"actions/setup-node": {"version": "1.3.0-beta.5+a3f2c1d", "tag": "1.3.0-beta.5-a3f2c1d"}} |

## Example with Custom Publishing

```yaml
jobs:
  release:
    uses: abinnovision/actions/.github/workflows/workflow.yaml@release-v1
    secrets:
      GH_APP_IDENTIFICATION_RELEASER: ${{ secrets.GH_APP_IDENTIFICATION_RELEASER }}
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'

  publish:
    name: Publish
    needs: release
    if: needs.release.outputs.releases-created == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Build and Publish
        run: |
          echo "Publishing packages: ${{ needs.release.outputs.paths-released }}"
          # Your publish logic here
```
