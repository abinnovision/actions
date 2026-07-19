# Changelog

## [1.2.3](https://github.com/abinnovision/actions/compare/gitops-update-tags-source-v1.2.2...gitops-update-tags-source-v1.2.3) (2026-07-19)


### Bug Fixes

* remove redundant repositories property from exchange-github-token consumers ([#481](https://github.com/abinnovision/actions/issues/481)) ([37b0628](https://github.com/abinnovision/actions/commit/37b06289698b94fe97f6ce018eac38dd53cc1944))

## [1.2.2](https://github.com/abinnovision/actions/compare/gitops-update-tags-source-v1.2.1...gitops-update-tags-source-v1.2.2) (2026-07-19)


### Bug Fixes

* pass scope and repositories to exchange-github-token in workflows ([#473](https://github.com/abinnovision/actions/issues/473)) ([b5e3c0a](https://github.com/abinnovision/actions/commit/b5e3c0a7a1723cc1d55b1ab254e5ec5c2b6a1aa7))

## [1.2.1](https://github.com/abinnovision/actions/compare/gitops-update-tags-source-v1.2.0...gitops-update-tags-source-v1.2.1) (2026-07-19)


### Bug Fixes

* move vars context from workflow_call defaults to job-level fallbacks ([#465](https://github.com/abinnovision/actions/issues/465)) ([9a3c4ae](https://github.com/abinnovision/actions/commit/9a3c4aebe511feda932ea3f2aca590688454e4fc))

## [1.2.0](https://github.com/abinnovision/actions/compare/gitops-update-tags-source-v1.1.5...gitops-update-tags-source-v1.2.0) (2026-07-19)


### Features

* **exchange-github-token:** add OIDC token exchange action, remove deprecated actions ([#453](https://github.com/abinnovision/actions/issues/453)) ([d7c6155](https://github.com/abinnovision/actions/commit/d7c6155a11f312d9923e6a245a167099e942f0df))
* use token broker ([#456](https://github.com/abinnovision/actions/issues/456)) ([a8dc1ac](https://github.com/abinnovision/actions/commit/a8dc1ace2551c90fa1b258ae0e75fc0e616bf95e))


### Reverts

* failed release ([#454](https://github.com/abinnovision/actions/issues/454)), fix setup-k8s-tools dependency ([#459](https://github.com/abinnovision/actions/issues/459)) ([12c7a1d](https://github.com/abinnovision/actions/commit/12c7a1d86d305e42744342af4dd4171d4aac0cc8))

## [1.1.5](https://github.com/abinnovision/actions/compare/gitops-update-tags-source-v1.1.4...gitops-update-tags-source-v1.1.5) (2026-07-09)


### Bug Fixes

* **gitops-update-tags:** track updates as structured pairs and merge validation steps ([#414](https://github.com/abinnovision/actions/issues/414)) ([2cffa42](https://github.com/abinnovision/actions/commit/2cffa423e62d03639c3f2eff87b01ba2dcbc7723))

## [1.1.4](https://github.com/abinnovision/actions/compare/gitops-update-tags-source-v1.1.3...gitops-update-tags-source-v1.1.4) (2026-04-28)


### Bug Fixes

* replace setup-kustomize with setup-k8s-tool ([#378](https://github.com/abinnovision/actions/issues/378)) ([6212bbd](https://github.com/abinnovision/actions/commit/6212bbddf0fe812a4be82501f55e852d968c6083))

## [1.1.3](https://github.com/abinnovision/actions/compare/gitops-update-tags-source-v1.1.2...gitops-update-tags-source-v1.1.3) (2026-04-12)


### Bug Fixes

* upgrade GitHub actions to latest versions ([#365](https://github.com/abinnovision/actions/issues/365)) ([01d818a](https://github.com/abinnovision/actions/commit/01d818a9115747dbaf4e7b54fd3a3a64f94e1305))

## [1.1.2](https://github.com/abinnovision/actions/compare/gitops-update-tags-source-v1.1.1...gitops-update-tags-source-v1.1.2) (2026-02-22)


### Bug Fixes

* support floating semver ranges in actionDependencies ([#332](https://github.com/abinnovision/actions/issues/332)) ([a00cdcd](https://github.com/abinnovision/actions/commit/a00cdcd50a1586f39dfae8f34492ea5c3e52aaa6))

## [1.1.1](https://github.com/abinnovision/actions/compare/gitops-update-tags-source-v1.1.0...gitops-update-tags-source-v1.1.1) (2026-01-21)


### Bug Fixes

* replace manual kustomize installation with setup action ([#281](https://github.com/abinnovision/actions/issues/281)) ([86e00d2](https://github.com/abinnovision/actions/commit/86e00d24d15e125790b65b29c911fcc227db58d1))

## [1.1.0](https://github.com/abinnovision/actions/compare/gitops-update-tags-source-v1.0.0...gitops-update-tags-source-v1.1.0) (2025-12-18)


### Features

* add automerge functionality for specified images in workflow ([#274](https://github.com/abinnovision/actions/issues/274)) ([3e28ec3](https://github.com/abinnovision/actions/commit/3e28ec3d275c5b9868060fb6b7584c9a22e8830f))


### Bug Fixes

* collect all changes of a PR in the description ([#273](https://github.com/abinnovision/actions/issues/273)) ([fb2c3fa](https://github.com/abinnovision/actions/commit/fb2c3fa2e1c6a15647cc97ecd0012c19fe237704))
* extract image and tag pattern for gitops workflow ([#275](https://github.com/abinnovision/actions/issues/275)) ([d76718f](https://github.com/abinnovision/actions/commit/d76718fa88e65c56f882eb30608bedcd66db4317))

## 1.0.0 (2025-12-13)


### Features

* add gitops stack workflows ([#264](https://github.com/abinnovision/actions/issues/264)) ([6881abb](https://github.com/abinnovision/actions/commit/6881abb3c20108ed9e9839548f5d562fcafefb6d))
