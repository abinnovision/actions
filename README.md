# setup-gcp

Setup for the Google Cloud Platform. This uses the opinionated way of AB Innovision.
Authenticates either through the GCP_AUTH variable (service account) or directly
through a Workload Identity Federation provider.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@setup-gcp-v1
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@setup-gcp-v1`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@setup-gcp-v1.2.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input                        | Description                                                                                                                                                                                                                                                                                                                                 | Required | Default |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------- | :------ |
| `auth`                       | Deprecated: use "workload-identity-provider".<br>The "GCP_AUTH" variable, authenticating as a service account.<br>Mutually exclusive with "workload-identity-provider".                                                                                                                                                                     | No       | _empty_ |
| `workload-identity-provider` | Full Workload Identity Federation provider resource name.<br>Authenticates directly as the repository without a service account.<br>Mutually exclusive with "auth".                                                                                                                                                                         | No       | _empty_ |
| `token_format`               | Output format for the generated authentication token. For OAuth 2.0 access<br>tokens, specify "access_token". For OIDC tokens, specify "id_token". To<br>skip token generation, leave this value empty. Both formats require a<br>service account.<br><br>See: https://github.com/google-github-actions/auth/blob/v1.0.0/action.yml#L84-L90 | No       | _empty_ |
| `delegates`                  | List of additional service account emails or unique identities to use for<br>impersonation in the chain.<br><br>See: https://github.com/google-github-actions/auth/blob/v1.0.0/action.yml#L91-L96                                                                                                                                           | No       | _empty_ |
| `override-service-account`   | Overrides the default service account used for the GCP authentication which is provided through the<br>"auth" input. This is useful when the default service account is not the one you want to use.                                                                                                                                        | No       | _empty_ |
| `install-components`         | Whether to install additional [gcloud components](https://cloud.google.com/sdk/docs/components).<br>Provide a comma-separated list of components to install.<br><br>**Example**: "gke-gcloud-auth-plugin,kubectl".                                                                                                                          | No       | _empty_ |

## Outputs

| Output                  | Description                                                                                                                                                                                                                                                           |
| :---------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth_token`            | The intermediate authentication token, which can be used with direct<br>Workload Identity Federation (e.g. as password for "oauth2accesstoken"<br>when logging in to Artifact Registry).<br><br>See: https://github.com/google-github-actions/auth/blob/v3/action.yml |
| `access_token`          | The Google Cloud access token for calling other Google Cloud APIs. This is<br>only available when "token_format" is "access_token".<br><br>See: https://github.com/google-github-actions/auth/blob/v1.0.0/action.yml#L169-L172                                        |
| `credentials_file_path` | Path on the local filesystem where the generated credentials file resides.<br>This is only available if "create_credentials_file" was set to true.<br><br>See: https://github.com/google-github-actions/auth/blob/v1.0.0/action.yml#L165-L168                         |
| `id_token`              | The Google Cloud ID token. This is only available when "token_format" is<br>"id_token".<br><br>See: https://github.com/google-github-actions/auth/blob/v1.0.0/action.yml#L177-L180                                                                                    |
