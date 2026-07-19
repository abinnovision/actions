# Changelog

## [2.0.2](https://github.com/abinnovision/actions/compare/setup-k8s-tools-source-v2.0.1...setup-k8s-tools-source-v2.0.2) (2026-07-19)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @internal/action-tool-installer bumped to 2.0.0

## [2.0.1](https://github.com/abinnovision/actions/compare/setup-k8s-tools-source-v2.0.0...setup-k8s-tools-source-v2.0.1) (2026-07-19)


### Bug Fixes

* exclude draft and pre-release when resolving latest version ([#469](https://github.com/abinnovision/actions/issues/469)) ([4606d38](https://github.com/abinnovision/actions/commit/4606d382d75a19af2779b5355e3db440f1395044))

## [2.0.0](https://github.com/abinnovision/actions/compare/setup-k8s-tools-source-v1.1.1...setup-k8s-tools-source-v2.0.0) (2026-07-18)


### ⚠ BREAKING CHANGES

* rework version resolution (bare semver, no cache) ([#448](https://github.com/abinnovision/actions/issues/448))

### Features

* **action-tool-installer:** shared binary-fetching package ([#444](https://github.com/abinnovision/actions/issues/444)) ([cb9b2e0](https://github.com/abinnovision/actions/commit/cb9b2e091bf04fd98bcd3b48c4282d4e454fb455))
* rework version resolution (bare semver, no cache) ([#448](https://github.com/abinnovision/actions/issues/448)) ([b42f309](https://github.com/abinnovision/actions/commit/b42f309ac69be3f314a969bb7ee15a5355242c66))

## [1.1.1](https://github.com/abinnovision/actions/compare/setup-k8s-tools-source-v1.1.0...setup-k8s-tools-source-v1.1.1) (2026-07-09)


### Bug Fixes

* **deps:** bump @actions/cache from 6.0.0 to 6.1.0 ([#432](https://github.com/abinnovision/actions/issues/432)) ([3d6a204](https://github.com/abinnovision/actions/commit/3d6a2045ed95d79a74b7217b2f9953d79bb2e2dc))
* **setup-k8s-tools:** use a stable cache path so restores hit across runs ([#428](https://github.com/abinnovision/actions/issues/428)) ([25fb28a](https://github.com/abinnovision/actions/commit/25fb28a05f8cd49a693f559f47c35386fe332278))

## [1.1.0](https://github.com/abinnovision/actions/compare/setup-k8s-tools-source-v1.0.1...setup-k8s-tools-source-v1.1.0) (2026-05-06)


### Features

* **setup-k8s-tools:** add argocd CLI ([#389](https://github.com/abinnovision/actions/issues/389)) ([7f9f699](https://github.com/abinnovision/actions/commit/7f9f699b545706557469cd3fb693587daab0e3b5))
* **setup-k8s-tools:** cache latest tag lookups for 24h ([#384](https://github.com/abinnovision/actions/issues/384)) ([81e777d](https://github.com/abinnovision/actions/commit/81e777de1a069c485f0af6cf7a4a2fb10fe0ccf3))

## [1.0.1](https://github.com/abinnovision/actions/compare/setup-k8s-tools-source-v1.0.0...setup-k8s-tools-source-v1.0.1) (2026-04-28)


### Bug Fixes

* upgrade GitHub Action dependencies to latest versions ([#380](https://github.com/abinnovision/actions/issues/380)) ([a95663b](https://github.com/abinnovision/actions/commit/a95663bbd9220d7fd39e1914f81eb2c31680e113))

## 1.0.0 (2026-04-28)


### Features

* add setup-k8s-tools action ([#376](https://github.com/abinnovision/actions/issues/376)) ([daf014a](https://github.com/abinnovision/actions/commit/daf014a7200f49833c349f65501c5225b59593cd))
