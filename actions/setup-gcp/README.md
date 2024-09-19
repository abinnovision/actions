# setup-gcp

This action sets up access to the Google Cloud Platform (GCP). It can be used to authenticate to GCP using
the Service Account of the repository.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@setup-gcp-v1
        with:
          auth: ${{ vars.GCP_AUTH }} # The "GCP_AUTH" variable which is present in all repositories.
```

[//]: # "x-release-please-end"
