# get-github-app-token

Gets the token for the GitHub App based on the given identification.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@get-github-app-token-v1
        with:
          identification: ${{ <identification> }}
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@get-github-app-token-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@get-github-app-token-v1.2.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input            | Description                                                                                  | Required | Default |
| :--------------- | :------------------------------------------------------------------------------------------- | :------- | :------ |
| `identification` | Identification value of the GitHub App. Secret: 'GH*APP_IDENTIFICATION*<UPPERCASE APP NAME>' | Yes      |         |

## Outputs

| Output               | Description |
| :------------------- | :---------- |
| `token`              |             |
| `app-commiter-email` |             |
| `app-commiter-name`  |             |
