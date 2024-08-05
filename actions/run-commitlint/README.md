# run-commitlint

This action runs [commitlint](https://commitlint.js.org/) on your commits with
the [@abinnovision/commitlint-config](https://www.npmjs.com/package/@abinnovision/commitlint-config) config.

## Example usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  lint-commits:
    name: Lint commits
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: abinnovision/actions@run-commitlint-v1
```

[//]: # "x-release-please-end"
