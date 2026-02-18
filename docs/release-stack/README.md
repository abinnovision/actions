# Release Stack

Automated versioning and release management for monorepos. Provides conventional-commit-driven releases, prerelease
channels, and structured version output for downstream jobs.

## Prerequisites

- `release-please-config.json` — release-please configuration (release types, package paths, changelog settings)
- `.release-please-manifest.json` — tracks current versions for each package path
- [Conventional Commits](https://www.conventionalcommits.org/) — commit messages drive version bumps (`feat:` → minor,
  `fix:` → patch, `feat!:` / `BREAKING CHANGE` → major)

## Release Lifecycle

1. Developers merge pull requests with conventional commit messages.
2. The release workflow calls `run-release-please`, which creates or updates release PRs grouping pending changes per
   package.
3. When a release PR is merged, `run-release-please` publishes GitHub Releases and tags, then outputs the `versions`
   JSON.
4. Downstream jobs consume `versions` to publish packages, build images, or trigger deployments.

## Prerelease Channels

Prerelease channels produce versioned artifacts from unreleased changes without merging a release PR. Set the
`prerelease-channel` input to a channel name (e.g., `beta`, `canary`, `rc`).

### Version format

```
{next-version}-{channel}.{commit-count}+{short-sha}
```

| Segment          | Description                                          | Example     |
| :--------------- | :--------------------------------------------------- | :---------- |
| `{next-version}` | Next semver version from release-please              | `1.4.0`     |
| `{channel}`      | Channel name from `prerelease-channel` input         | `beta`      |
| `{commit-count}` | Commits since the last release tag                   | `5`         |
| `{short-sha}`    | First 7 characters of the commit SHA                 | `a3f2c1d`   |
| **Full version** |                                                      | `1.4.0-beta.5+a3f2c1d` |

### Docker-compatible tag

Docker tags cannot contain `+`. The `tag` field replaces `+` with `-`:

```
1.4.0-beta.5-a3f2c1d
```

### NPM dist-tag

For prerelease publishes, the channel name is used as the npm dist-tag:

```bash
yarn npm publish --tag beta
```

Consumers install with `npm install <package>@beta`.

## Version Output

The release workflow outputs a `versions` JSON object mapping package paths to version info.

### Structure

```json
{
  "<path>": {
    "version": "<semver>",
    "tag": "<docker-compatible-tag>",
    "type": "release" | "prerelease"
  }
}
```

### Fields

| Field     | Description                                                              |
| :-------- | :----------------------------------------------------------------------- |
| `version` | Full semver version string                                               |
| `tag`     | Docker-compatible version (`+` replaced with `-`)                        |
| `type`    | `"release"` for stable releases, `"prerelease"` for channel builds       |

### Examples

Stable release:

```json
{
  "packages/my-lib": {
    "version": "2.1.0",
    "tag": "2.1.0",
    "type": "release"
  }
}
```

Prerelease:

```json
{
  "packages/my-lib": {
    "version": "2.2.0-beta.3+a3f2c1d",
    "tag": "2.2.0-beta.3-a3f2c1d",
    "type": "prerelease"
  }
}
```

No releases:

```json
{}
```

Use `versions != '{}'` to check whether any releases were produced.

## Workflow Examples

### release.yaml

```yaml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    name: Release
    uses: abinnovision/actions/.github/workflows/workflow.yaml@release-v2
    permissions:
      contents: read
      id-token: write
    secrets:
      GH_APP_IDENTIFICATION_RELEASER: ${{ secrets.GH_APP_IDENTIFICATION_RELEASER }}
```

### release.yaml with prerelease channel

```yaml
name: Release

on:
  push:
    branches:
      - main
      - beta

jobs:
  release:
    name: Release
    uses: abinnovision/actions/.github/workflows/workflow.yaml@release-v2
    permissions:
      contents: read
      id-token: write
    with:
      prerelease-channel: ${{ github.ref_name != 'main' && github.ref_name || '' }}
    secrets:
      GH_APP_IDENTIFICATION_RELEASER: ${{ secrets.GH_APP_IDENTIFICATION_RELEASER }}
```

### Consuming version output

```yaml
  publish:
    name: Publish
    needs: release
    if: needs.release.outputs.versions != '{}'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Process versions
        run: |
          VERSIONS='${{ needs.release.outputs.versions }}'

          # Extract entries by path prefix
          PACKAGES=$(echo "$VERSIONS" | jq -c '[to_entries[] | select(.key | startswith("packages/"))]')

          # Iterate and publish
          for entry in $(echo "$PACKAGES" | jq -c '.[]'); do
            VERSION=$(echo "$entry" | jq -r '.value.version')
            TYPE=$(echo "$entry" | jq -r '.value.type')

            NPM_TAG=""
            if [[ "$TYPE" == "prerelease" ]]; then
              NPM_TAG="--tag ${{ inputs.prerelease-channel }}"
            fi

            # Publish logic here
          done
```

## References

- [`workflows/release`](../../workflows/release/README.md) — Reusable release workflow
- [`actions/run-release-please`](../../actions/run-release-please/README.md) — Release-please action with prerelease
  support
- [`workflows/polyglot-monorepo-stack`](../../workflows/polyglot-monorepo-stack/README.md) — Full CI/CD stack using the
  release workflow
- [`workflows/node-monorepo-stack`](../../workflows/node-monorepo-stack/README.md) — Node-specific CI/CD stack
