# Changelog

## [1.5.2](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.5.1...polyglot-monorepo-stack-source-v1.5.2) (2026-07-19)


### Bug Fixes

* prefix gitops target repo with org in polyglot workflow ([#482](https://github.com/abinnovision/actions/issues/482)) ([f6e4850](https://github.com/abinnovision/actions/commit/f6e4850c3c0b46f615b3e78d8ed50c9122a97bcd))

## [1.5.1](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.5.0...polyglot-monorepo-stack-source-v1.5.1) (2026-07-19)


### Bug Fixes

* move vars context from workflow_call defaults to job-level fallbacks ([#465](https://github.com/abinnovision/actions/issues/465)) ([9a3c4ae](https://github.com/abinnovision/actions/commit/9a3c4aebe511feda932ea3f2aca590688454e4fc))

## [1.5.0](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.4.2...polyglot-monorepo-stack-source-v1.5.0) (2026-07-19)


### Features

* **exchange-github-token:** add OIDC token exchange action, remove deprecated actions ([#453](https://github.com/abinnovision/actions/issues/453)) ([d7c6155](https://github.com/abinnovision/actions/commit/d7c6155a11f312d9923e6a245a167099e942f0df))
* use token broker ([#456](https://github.com/abinnovision/actions/issues/456)) ([a8dc1ac](https://github.com/abinnovision/actions/commit/a8dc1ace2551c90fa1b258ae0e75fc0e616bf95e))


### Bug Fixes

* **polyglot-monorepo-stack:** remove dead GITOPS_PROXY_URL secret ([#461](https://github.com/abinnovision/actions/issues/461)) ([71eccce](https://github.com/abinnovision/actions/commit/71eccce56f5fdc79c46c2d880c7a429124c7a950))


### Reverts

* failed release ([#454](https://github.com/abinnovision/actions/issues/454)), fix setup-k8s-tools dependency ([#459](https://github.com/abinnovision/actions/issues/459)) ([12c7a1d](https://github.com/abinnovision/actions/commit/12c7a1d86d305e42744342af4dd4171d4aac0cc8))

## [1.4.2](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.4.1...polyglot-monorepo-stack-source-v1.4.2) (2026-07-15)


### Bug Fixes

* **polyglot:** skip Publish / Prepare job on pull requests ([#441](https://github.com/abinnovision/actions/issues/441)) ([124a990](https://github.com/abinnovision/actions/commit/124a9902bb0aa257c18fcd33627b17e61cf355d5))

## [1.4.1](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.4.0...polyglot-monorepo-stack-source-v1.4.1) (2026-05-19)


### Bug Fixes

* **polyglot-monorepo-stack:** only deploy gh-pages on stable releases ([#407](https://github.com/abinnovision/actions/issues/407)) ([ad364d5](https://github.com/abinnovision/actions/commit/ad364d5dca773407bf690840ae74631c75e324c0))

## [1.4.0](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.3.0...polyglot-monorepo-stack-source-v1.4.0) (2026-05-18)


### Features

* **polyglot-monorepo-stack:** publish npm packages with provenance attestations ([#404](https://github.com/abinnovision/actions/issues/404)) ([b1d0707](https://github.com/abinnovision/actions/commit/b1d0707d9fc87c1fef3d3bc7a52b4841a23fb099))

## [1.3.0](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.2.0...polyglot-monorepo-stack-source-v1.3.0) (2026-05-12)


### Features

* **polyglot-monorepo-stack:** add GitHub Pages deployment support ([#402](https://github.com/abinnovision/actions/issues/402)) ([0d05700](https://github.com/abinnovision/actions/commit/0d0570030111e5ecbf7a74ce3cb492c232e6cbc7))

## [1.2.0](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.1.5...polyglot-monorepo-stack-source-v1.2.0) (2026-04-12)


### Features

* add sha field to versions output and avoid duplicate builds ([#355](https://github.com/abinnovision/actions/issues/355)) ([4839cf5](https://github.com/abinnovision/actions/commit/4839cf56b3947bc3addc2e1d9194eda8327f78ef))


### Bug Fixes

* change default value for enable-apps-registry-ghcr to false ([#366](https://github.com/abinnovision/actions/issues/366)) ([8253dc8](https://github.com/abinnovision/actions/commit/8253dc8e439772ec0a0fd5101cb3939033128482))
* streamline workflow and simplify ([#367](https://github.com/abinnovision/actions/issues/367)) ([68caeee](https://github.com/abinnovision/actions/commit/68caeee38083d82fb4c9d3b86f933c8c11a70819))
* update workflow naming conventions for clarity ([#364](https://github.com/abinnovision/actions/issues/364)) ([25b2578](https://github.com/abinnovision/actions/commit/25b257854e2c97af2b99a8876d1a82b1a19ae377))
* upgrade GitHub actions to latest versions ([#365](https://github.com/abinnovision/actions/issues/365)) ([01d818a](https://github.com/abinnovision/actions/commit/01d818a9115747dbaf4e7b54fd3a3a64f94e1305))

## [1.1.5](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.1.4...polyglot-monorepo-stack-source-v1.1.5) (2026-02-22)


### Bug Fixes

* support floating semver ranges in actionDependencies ([#332](https://github.com/abinnovision/actions/issues/332)) ([a00cdcd](https://github.com/abinnovision/actions/commit/a00cdcd50a1586f39dfae8f34492ea5c3e52aaa6))

## [1.1.4](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.1.3...polyglot-monorepo-stack-source-v1.1.4) (2026-02-19)


### Bug Fixes

* use release-please version outputs directly for Docker builds ([#324](https://github.com/abinnovision/actions/issues/324)) ([b8eabdf](https://github.com/abinnovision/actions/commit/b8eabdf3785e66d900e29c31add528d9350d7d16))

## [1.1.3](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.1.2...polyglot-monorepo-stack-source-v1.1.3) (2026-02-19)


### Bug Fixes

* use packageVersion instead of version for npm publishing ([#322](https://github.com/abinnovision/actions/issues/322)) ([ce82d4b](https://github.com/abinnovision/actions/commit/ce82d4b3581848e9c711d7226967dcac0b8de7d2))

## [1.1.2](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.1.1...polyglot-monorepo-stack-source-v1.1.2) (2026-02-19)


### Bug Fixes

* update versioning structure to include packageVersion and short SHA ([#320](https://github.com/abinnovision/actions/issues/320)) ([f6586bd](https://github.com/abinnovision/actions/commit/f6586bd30a741e6586b71136dcfca38e6536225c))

## [1.1.1](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.1.0...polyglot-monorepo-stack-source-v1.1.1) (2026-02-18)


### Bug Fixes

* run npm publish with switching directories in a subshell ([#318](https://github.com/abinnovision/actions/issues/318)) ([6c747be](https://github.com/abinnovision/actions/commit/6c747be8bdf8324365aaba51cad09a9ee752226f))

## [1.1.0](https://github.com/abinnovision/actions/compare/polyglot-monorepo-stack-source-v1.0.0...polyglot-monorepo-stack-source-v1.1.0) (2026-02-18)


### Features

* add support for prerelease channels and enhance release outputs ([#300](https://github.com/abinnovision/actions/issues/300)) ([04450e4](https://github.com/abinnovision/actions/commit/04450e418ae28df8a606b80266d93d26f7e21f09))
* implement run-release-please action ([#305](https://github.com/abinnovision/actions/issues/305)) ([5923820](https://github.com/abinnovision/actions/commit/5923820cbf91500a1d82c345dcf0251d4d1d00a5))


### Bug Fixes

* enhance workflow outputs to include release type and improve version handling ([#304](https://github.com/abinnovision/actions/issues/304)) ([4c0bdeb](https://github.com/abinnovision/actions/commit/4c0bdeba937b3b005ff0ef2bd85d638fa996ef9c))
* refactor version evaluation ([#306](https://github.com/abinnovision/actions/issues/306)) ([9475f1c](https://github.com/abinnovision/actions/commit/9475f1c189f71e3c3302f9acb0bbba1fd8f2bdb1))

## 1.0.0 (2026-02-05)


### Features

* create polyglot-monorepo-stack workflow ([#294](https://github.com/abinnovision/actions/issues/294)) ([fbd9f43](https://github.com/abinnovision/actions/commit/fbd9f43df35b1b4dce19e318b636d06133524f9e))
