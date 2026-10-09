# Changelog

## [2.0.0](https://github.com/abinnovision/actions/compare/gitops-stack-source-v1.0.1...gitops-stack-source-v2.0.0) (2026-10-09)


### ⚠ BREAKING CHANGES

* **gitops-stack:** validate manifests in Check and use the public DEX client ([#630](https://github.com/abinnovision/actions/issues/630))

### Features

* **gitops-stack:** validate manifests in Check and use the public DEX client ([#630](https://github.com/abinnovision/actions/issues/630)) ([9d5a6fc](https://github.com/abinnovision/actions/commit/9d5a6fce3bdb7f83b7b14839c90d22d9ce135fbc))


### Bug Fixes

* **gitops-stack:** fall back to the core ArgoCD and DEX variables ([#635](https://github.com/abinnovision/actions/issues/635)) ([846bad2](https://github.com/abinnovision/actions/commit/846bad246da0887deb13d13d917871cc3c1ac98f))
* **gitops-stack:** trim kubeconform schema locations and fix readme examples ([#634](https://github.com/abinnovision/actions/issues/634)) ([fd8c622](https://github.com/abinnovision/actions/commit/fd8c6229cce4e4643fee7ee91b842675dcd5ec08))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * setup-tools bumped to 1.2.0

## [1.0.1](https://github.com/abinnovision/actions/compare/gitops-stack-source-v1.0.0...gitops-stack-source-v1.0.1) (2026-10-07)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * setup-k8s-tools bumped to 2.0.4
    * setup-oidc-token-cli bumped to 1.1.4

## 1.0.0 (2026-10-03)


### Features

* align stacks and move publishing into publish workflows ([#590](https://github.com/abinnovision/actions/issues/590)) ([6f689c1](https://github.com/abinnovision/actions/commit/6f689c11d6851ac54b9d092f4f7a0a2fc5e3e740))
