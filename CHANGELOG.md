# Changelog

## [1.1.0](https://github.com/abinnovision/actions/compare/gitops-deploy-source-v1.0.9...gitops-deploy-source-v1.1.0) (2026-07-20)


### Features

* **gitops-deploy:** add optional sync-prune input ([#491](https://github.com/abinnovision/actions/issues/491)) ([580a7b0](https://github.com/abinnovision/actions/commit/580a7b0ec53a1af551c83dad9b40d29dd5608df7))
* **gitops-deploy:** use oidc-token-cli for DEX token exchange ([#493](https://github.com/abinnovision/actions/issues/493)) ([707ab2b](https://github.com/abinnovision/actions/commit/707ab2bc541f2f566517f404876b6fd89900361f))

## [1.0.9](https://github.com/abinnovision/actions/compare/gitops-deploy-source-v1.0.8...gitops-deploy-source-v1.0.9) (2026-07-19)


### Bug Fixes

* bump setup-k8s-tools actionDependency to ^2.0.0 and add version check to CI ([#458](https://github.com/abinnovision/actions/issues/458)) ([c0db043](https://github.com/abinnovision/actions/commit/c0db043019e67fd1d317223fb281f7202187ca1a))

## [1.0.8](https://github.com/abinnovision/actions/compare/gitops-deploy-source-v1.0.7...gitops-deploy-source-v1.0.8) (2026-05-06)


### Bug Fixes

* **gitops-deploy:** use commit SHA instead of branch ref for ArgoCD diff ([#396](https://github.com/abinnovision/actions/issues/396)) ([39adb70](https://github.com/abinnovision/actions/commit/39adb702f6b4fb6ba959a2684bace6a3ac47837e))

## [1.0.7](https://github.com/abinnovision/actions/compare/gitops-deploy-source-v1.0.6...gitops-deploy-source-v1.0.7) (2026-05-06)


### Bug Fixes

* **gitops-deploy:** rename configure job back to check ([#394](https://github.com/abinnovision/actions/issues/394)) ([cd44c3f](https://github.com/abinnovision/actions/commit/cd44c3f79021c096e6a25cfd0d161df36dc1fa06))

## [1.0.6](https://github.com/abinnovision/actions/compare/gitops-deploy-source-v1.0.5...gitops-deploy-source-v1.0.6) (2026-05-06)


### Bug Fixes

* **gitops-deploy:** define YAML anchors inline to avoid schema rejection ([#392](https://github.com/abinnovision/actions/issues/392)) ([308ae72](https://github.com/abinnovision/actions/commit/308ae723463506c0688b5303866113a6ccca0156))

## [1.0.5](https://github.com/abinnovision/actions/compare/gitops-deploy-source-v1.0.4...gitops-deploy-source-v1.0.5) (2026-05-06)


### Bug Fixes

* **gitops-deploy:** deduplicate steps and refactor workflow ([#390](https://github.com/abinnovision/actions/issues/390)) ([1f00db1](https://github.com/abinnovision/actions/commit/1f00db1f7723873a1c04b0b83911796baf19f38a))

## [1.0.4](https://github.com/abinnovision/actions/compare/gitops-deploy-source-v1.0.3...gitops-deploy-source-v1.0.4) (2026-04-28)


### Bug Fixes

* replace setup-kustomize with setup-k8s-tool ([#378](https://github.com/abinnovision/actions/issues/378)) ([6212bbd](https://github.com/abinnovision/actions/commit/6212bbddf0fe812a4be82501f55e852d968c6083))

## [1.0.3](https://github.com/abinnovision/actions/compare/gitops-deploy-source-v1.0.2...gitops-deploy-source-v1.0.3) (2026-04-12)


### Bug Fixes

* upgrade GitHub actions to latest versions ([#365](https://github.com/abinnovision/actions/issues/365)) ([01d818a](https://github.com/abinnovision/actions/commit/01d818a9115747dbaf4e7b54fd3a3a64f94e1305))

## [1.0.2](https://github.com/abinnovision/actions/compare/gitops-deploy-source-v1.0.1...gitops-deploy-source-v1.0.2) (2026-02-22)


### Bug Fixes

* support floating semver ranges in actionDependencies ([#332](https://github.com/abinnovision/actions/issues/332)) ([a00cdcd](https://github.com/abinnovision/actions/commit/a00cdcd50a1586f39dfae8f34492ea5c3e52aaa6))

## [1.0.1](https://github.com/abinnovision/actions/compare/gitops-deploy-source-v1.0.0...gitops-deploy-source-v1.0.1) (2026-01-21)


### Bug Fixes

* replace manual kustomize installation with setup action ([#281](https://github.com/abinnovision/actions/issues/281)) ([86e00d2](https://github.com/abinnovision/actions/commit/86e00d24d15e125790b65b29c911fcc227db58d1))

## 1.0.0 (2025-12-13)


### Features

* add gitops stack workflows ([#264](https://github.com/abinnovision/actions/issues/264)) ([6881abb](https://github.com/abinnovision/actions/commit/6881abb3c20108ed9e9839548f5d562fcafefb6d))
