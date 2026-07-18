# setup-k8s-tools

Installs kubernetes tooling (kube-score, kubeconform, kustomize, argocd) with
GitHub Actions tool caching. Pass &#x27;latest&#x27; or a pinned version per tool;
omit or leave empty to skip a tool.

## Tools

| Tool          | Repository                                                                | Version format | Example pin |
| :------------ | :------------------------------------------------------------------------ | :------------- | :---------- |
| `kube-score`  | [zegl/kube-score](https://github.com/zegl/kube-score)                     | `X.Y.Z`        | `1.18.0`    |
| `kubeconform` | [yannh/kubeconform](https://github.com/yannh/kubeconform)                 | `X.Y.Z`        | `0.6.4`     |
| `kustomize`   | [kubernetes-sigs/kustomize](https://github.com/kubernetes-sigs/kustomize) | `X.Y.Z`        | `5.4.3`     |
| `argocd`      | [argoproj/argo-cd](https://github.com/argoproj/argo-cd)                   | `X.Y.Z`        | `2.13.0`    |

Each tool input accepts `"latest"` to resolve and install the newest release at runtime, a pinned version string (e.g. `"5.4.3"`) for reproducible builds, or an empty string to skip that tool entirely. The resolved version is written to the corresponding output and used as the tool-cache key, so re-runs on the same runner skip redundant downloads.

## Usage

[//]: # "x-release-please-start-major"

```yaml
jobs:
  <job>:
    steps:
      - uses: abinnovision/actions@setup-k8s-tools-v2
        with:
          github-token: ${{ github.token }}
```

[//]: # "x-release-please-end"

## Latest versions

This action can be used with different version ranges. The following ranges are available:

- `abinnovision/actions@setup-k8s-tools-v2`: Targeting major version <!-- x-release-please-major -->
- `abinnovision/actions@setup-k8s-tools-v2.0.0`: Targeting a patch version <!-- x-release-please-version -->

## Inputs

| Input          | Description                                                     | Required | Default               |
| :------------- | :-------------------------------------------------------------- | :------- | :-------------------- |
| `github-token` | GitHub token for authenticated API and asset download requests. | Yes      | `${{ github.token }}` |
| `kube-score`   | Version to install ("latest" or e.g. "1.18.0"). Empty = skip.   | No       | _empty_               |
| `kubeconform`  | Version to install ("latest" or e.g. "0.6.4"). Empty = skip.    | No       | _empty_               |
| `kustomize`    | Version to install ("latest" or e.g. "5.4.3"). Empty = skip.    | No       | _empty_               |
| `argocd`       | Version to install ("latest" or e.g. "2.13.0"). Empty = skip.   | No       | _empty_               |

## Outputs

| Output                | Description                                                |
| :-------------------- | :--------------------------------------------------------- |
| `kube-score-version`  | Resolved kube-score version installed (empty if skipped).  |
| `kubeconform-version` | Resolved kubeconform version installed (empty if skipped). |
| `kustomize-version`   | Resolved kustomize version installed (empty if skipped).   |
| `argocd-version`      | Resolved argocd version installed (empty if skipped).      |

Each `<tool>-version` output is the resolved bare semver (e.g. `5.4.3`, without a `v` prefix).
