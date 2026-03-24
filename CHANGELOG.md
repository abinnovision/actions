# Changelog

## [1.3.2](https://github.com/abinnovision/actions/compare/node-monorepo-stack-source-v1.3.1...node-monorepo-stack-source-v1.3.2) (2026-02-22)


### Bug Fixes

* support floating semver ranges in actionDependencies ([#332](https://github.com/abinnovision/actions/issues/332)) ([a00cdcd](https://github.com/abinnovision/actions/commit/a00cdcd50a1586f39dfae8f34492ea5c3e52aaa6))

## [1.3.1](https://github.com/abinnovision/actions/compare/node-monorepo-stack-source-v1.3.0...node-monorepo-stack-source-v1.3.1) (2026-02-18)


### Bug Fixes

* run npm publish with switching directories in a subshell ([#318](https://github.com/abinnovision/actions/issues/318)) ([6c747be](https://github.com/abinnovision/actions/commit/6c747be8bdf8324365aaba51cad09a9ee752226f))

## [1.3.0](https://github.com/abinnovision/actions/compare/node-monorepo-stack-source-v1.2.1...node-monorepo-stack-source-v1.3.0) (2026-02-18)


### Features

* implement run-release-please action ([#305](https://github.com/abinnovision/actions/issues/305)) ([5923820](https://github.com/abinnovision/actions/commit/5923820cbf91500a1d82c345dcf0251d4d1d00a5))

## [1.2.1](https://github.com/abinnovision/actions/compare/node-monorepo-stack-source-v1.2.0...node-monorepo-stack-source-v1.2.1) (2026-01-26)


### Bug Fixes

* custom checkout token as secret ([#289](https://github.com/abinnovision/actions/issues/289)) ([2e18c59](https://github.com/abinnovision/actions/commit/2e18c59b1b3fdd3439925d5d65cb1f54f831bb34))

## [1.2.0](https://github.com/abinnovision/actions/compare/node-monorepo-stack-source-v1.1.1...node-monorepo-stack-source-v1.2.0) (2026-01-26)


### Features

* option for custom checkout token ([#287](https://github.com/abinnovision/actions/issues/287)) ([ec93a0c](https://github.com/abinnovision/actions/commit/ec93a0cef91158a54fd29cf36655c2c1ce0d1047))

## [1.1.1](https://github.com/abinnovision/actions/compare/node-monorepo-stack-source-v1.1.0...node-monorepo-stack-source-v1.1.1) (2026-01-26)


### Bug Fixes

* input with brackets ([28ef20d](https://github.com/abinnovision/actions/commit/28ef20d24f3c366c2bd08fc1832f852b43f17b48))

## [1.1.0](https://github.com/abinnovision/actions/compare/node-monorepo-stack-source-v1.0.2...node-monorepo-stack-source-v1.1.0) (2026-01-26)


### Features

* option to checkout with submodules ([#283](https://github.com/abinnovision/actions/issues/283)) ([a423787](https://github.com/abinnovision/actions/commit/a423787a00ebaabf6b4c3579a3354b97bf3297fc))

## [1.0.2](https://github.com/abinnovision/actions/compare/node-monorepo-stack-source-v1.0.1...node-monorepo-stack-source-v1.0.2) (2026-01-10)


### Bug Fixes

* change directory before publishing package ([#280](https://github.com/abinnovision/actions/issues/280)) ([64a70d7](https://github.com/abinnovision/actions/commit/64a70d7e6a52c7f79eeb24831b2c485a1e11be9e))
* use yarn for publishing packages in workflow ([#278](https://github.com/abinnovision/actions/issues/278)) ([4c7ed5a](https://github.com/abinnovision/actions/commit/4c7ed5a19006ac3b87bf3c226b6bfa2e4203b2ac))

## [1.0.1](https://github.com/abinnovision/actions/compare/node-monorepo-stack-source-v1.0.0...node-monorepo-stack-source-v1.0.1) (2025-12-18)


### Bug Fixes

* disable provenance option in npm publish command ([#272](https://github.com/abinnovision/actions/issues/272)) ([6972366](https://github.com/abinnovision/actions/commit/69723666c4c4fdabc39042c087650aac8c9d6378))
* remove npmAuthToken set command ([#270](https://github.com/abinnovision/actions/issues/270)) ([0569fe0](https://github.com/abinnovision/actions/commit/0569fe055534234477ad7dbd26e9a12457d326ee))

## 1.0.0 (2025-12-13)


### Features

* add node-monorepo-stack workflow ([#258](https://github.com/abinnovision/actions/issues/258)) ([e230598](https://github.com/abinnovision/actions/commit/e230598b66ee583fd3af03547c3e74fb6f65c17f))


### Bug Fixes

* add gitops integration ([bf11087](https://github.com/abinnovision/actions/commit/bf11087960e87bdae5131008d5459504461167c8))
* add option to run build before checks ([#262](https://github.com/abinnovision/actions/issues/262)) ([9473e54](https://github.com/abinnovision/actions/commit/9473e54c4038af25257cfabae04cbb559d238e22))
* adjust condition ([bbfd685](https://github.com/abinnovision/actions/commit/bbfd68534d1ad1f640886fe3cfafdabffa52a0cc))
* adjust condition to run apps build ([ebab8f0](https://github.com/abinnovision/actions/commit/ebab8f0baa51abf4ba6c82551dffaedcbd162b87))
* adjust condition to run release ([540fb87](https://github.com/abinnovision/actions/commit/540fb871a1fcc0781146de1204db60aa50a1a2fd))
* adjust conditions ([f4dca0f](https://github.com/abinnovision/actions/commit/f4dca0fde5299ed435491dfd5d69b18f44f93e46))
* align condition ([6c7db42](https://github.com/abinnovision/actions/commit/6c7db42ceaee9a274456e7dcccb9d9d2830dd7a6))
* avoid usage of yaml anchors ([d34bb99](https://github.com/abinnovision/actions/commit/d34bb99c59eea89457c2bc07dcd14e11e29ab22f))
* build all packages from 'packages' directory ([#263](https://github.com/abinnovision/actions/issues/263)) ([f9e6214](https://github.com/abinnovision/actions/commit/f9e62143dcac80bc5b1812c9838902b6c7ae2447))
* migrate to NPM OIDC publishing ([#268](https://github.com/abinnovision/actions/issues/268)) ([bf21fe7](https://github.com/abinnovision/actions/commit/bf21fe7c65b5912e2396885d857014a844d158ad))
* only pass the tag to the gitops workflow dispatch ([8c096de](https://github.com/abinnovision/actions/commit/8c096ded4110b26f3db5da5bc9ab551006f98494))
* output built image references ([56a6431](https://github.com/abinnovision/actions/commit/56a6431d6530ab7a644fa3a4569025a1df321636))
* refactor app secrets parsing ([3224a10](https://github.com/abinnovision/actions/commit/3224a100e12d9b1fd48d2ca1bef38c852bdb90b4))
* remove ability to set explicit tokens ([4b7eda0](https://github.com/abinnovision/actions/commit/4b7eda0cd019d2ff6bb03423b50299b27f21ad0d))
* remove dependency on 'test' ([34e569d](https://github.com/abinnovision/actions/commit/34e569d1e1c5ecb2d61e69dc809ada3113e03d8e))
* remove unnecessary debug output ([c583679](https://github.com/abinnovision/actions/commit/c5836797e0d8dcf214f4b4219547113312f1974b))
* simplify gitops configuration ([2017ab9](https://github.com/abinnovision/actions/commit/2017ab9b1cd30cc8ca9c9307fcc45a4c403d5b7b))
* simplify the condition to run app image builds ([270268f](https://github.com/abinnovision/actions/commit/270268f26f3262d5b4b8f09eb224b6e75122f4b9))
* update secret handling in README and workflow for Docker builds ([#260](https://github.com/abinnovision/actions/issues/260)) ([7de07f6](https://github.com/abinnovision/actions/commit/7de07f6a74863441970c97d85912e13df2405f66))
* update secrets handling and upgrade build-push action version ([#261](https://github.com/abinnovision/actions/issues/261)) ([d6b2a5c](https://github.com/abinnovision/actions/commit/d6b2a5cb627fe7103aa747d452fbd20dd01f1f01))
* use correct utitlity functions ([e864570](https://github.com/abinnovision/actions/commit/e86457095848d72388e111b68950256f8cfd4ffc))
