# run-commitlint

This action runs [commitlint](https://commitlint.js.org/) on your commits with the [@abinnovision/commitlint-config](https://www.npmjs.com/package/@abinnovision/commitlint-config) config.

## Example usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@run-commitlint-v1
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@run-commitlint-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@run-commitlint-v1.2.0`: Targeting a patch version <!-- x-release-please-version -->
