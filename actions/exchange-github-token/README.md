# exchange-github-token

Exchange a GitHub Actions OIDC token for a GitHub App installation token via a compatible token broker

Exchanges a GitHub Actions OIDC token for a GitHub App installation token using the
[RFC 8693 OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693) flow.
The action handles the full exchange via
[`oidc-token-cli`](https://github.com/abinnovision/oidc-token-cli): OIDC discovery, subject token
acquisition from the GitHub Actions runtime, and the token exchange request.

Compatible with any token broker that implements RFC 8693 with OIDC discovery.
[`abinnovision/gh-token-broker`](https://github.com/abinnovision/gh-token-broker) is one such implementation.

## Usage

```yaml
permissions:
  id-token: write

steps:
  - id: token
    uses: abinnovision/actions@exchange-github-token-v1
    with:
      broker-url: ${{ secrets.GH_TOKEN_BROKER_URL }}
      scope: |
        contents:write
        pull_requests:write
      repositories: |
        my-org/repo-a
        my-org/repo-b

  - name: Use the token
    env:
      GH_TOKEN: ${{ steps.token.outputs.token }}
    run: |
      echo "Token acquired for ${{ steps.token.outputs.committer-name }}"
```

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@exchange-github-token-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@exchange-github-token-v1.2.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                    | Description                                                                           | Required | Default               |
| :----------------------- | :------------------------------------------------------------------------------------ | :------- | :-------------------- |
| `broker-url`             | Base URL of the token broker service (used as OIDC issuer for discovery)              | Yes      |                       |
| `audience`               | OIDC audience for the token broker (defaults to broker-url)                           | No       | _empty_               |
| `scope`                  | Permission scopes, whitespace-separated (e.g. contents:write pull_requests:write)     | Yes      |                       |
| `repositories`           | Repositories the token should access, whitespace-separated (defaults to current repo) | No       | _empty_               |
| `github-token`           | Token for downloading oidc-token-cli from GitHub releases                             | No       | `${{ github.token }}` |
| `oidc-token-cli-version` | Version of oidc-token-cli to install                                                  | No       | `latest`              |

## Outputs

| Output            | Description                             |
| :---------------- | :-------------------------------------- |
| `token`           | GitHub App installation token           |
| `committer-name`  | Bot committer name (e.g. app-name[bot]) |
| `committer-email` | Bot committer email                     |
