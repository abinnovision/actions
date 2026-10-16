# Changelog

## [1.4.0](https://github.com/abinnovision/actions/compare/app-stack-source-v1.3.0...app-stack-source-v1.4.0) (2026-10-16)


### Features

* **app-stack:** add a tallyrelease release dry run to shadow mode ([#682](https://github.com/abinnovision/actions/issues/682)) ([6a9b95f](https://github.com/abinnovision/actions/commit/6a9b95f40dcf4cd9560fe9b71c0f7bede078c665))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * run-tallyrelease bumped to 0.4.0

## [1.3.0](https://github.com/abinnovision/actions/compare/app-stack-source-v1.2.0...app-stack-source-v1.3.0) (2026-10-15)


### Features

* **app-stack:** add beta tallyrelease shadow mode and release plan ([#677](https://github.com/abinnovision/actions/issues/677)) ([2a62502](https://github.com/abinnovision/actions/commit/2a62502590798b7dda3568d9212729f105144fc6))


### Bug Fixes

* limit release-please major markers to the own ref in usage examples ([#680](https://github.com/abinnovision/actions/issues/680)) ([a0d28c0](https://github.com/abinnovision/actions/commit/a0d28c0469da5f79c68ef8775f0e8002d078836b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * run-tallyrelease bumped to 0.3.0

## [1.2.0](https://github.com/abinnovision/actions/compare/app-stack-source-v1.1.0...app-stack-source-v1.2.0) (2026-10-15)


### Features

* **run-tallyrelease:** add beta tallyrelease action and affected build selection ([#674](https://github.com/abinnovision/actions/issues/674)) ([907bf66](https://github.com/abinnovision/actions/commit/907bf66e990585429658f4f4af77632462eb9838))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * run-tallyrelease bumped to 0.2.0

## [1.1.0](https://github.com/abinnovision/actions/compare/app-stack-source-v1.0.6...app-stack-source-v1.1.0) (2026-10-15)


### Features

* **run-release-please:** expose release url in release list ([#669](https://github.com/abinnovision/actions/issues/669)) ([1fcaef4](https://github.com/abinnovision/actions/commit/1fcaef46c62cad7197a07fe76b30eb3de4ce9b80))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * run-release-please bumped to 1.3.0

## [1.0.6](https://github.com/abinnovision/actions/compare/app-stack-source-v1.0.5...app-stack-source-v1.0.6) (2026-10-14)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * setup-tools bumped to 2.0.0

## [1.0.5](https://github.com/abinnovision/actions/compare/app-stack-source-v1.0.4...app-stack-source-v1.0.5) (2026-10-13)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * setup-tools bumped to 1.2.1

## [1.0.4](https://github.com/abinnovision/actions/compare/app-stack-source-v1.0.3...app-stack-source-v1.0.4) (2026-10-13)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * evaluate-event bumped to 1.1.0
    * match-paths bumped to 1.1.0

## [1.0.3](https://github.com/abinnovision/actions/compare/app-stack-source-v1.0.2...app-stack-source-v1.0.3) (2026-10-09)


### Bug Fixes

* align checkout credentials and lane names across stacks ([#631](https://github.com/abinnovision/actions/issues/631)) ([44d7f70](https://github.com/abinnovision/actions/commit/44d7f700ff8177b0f90188cc13524a8f281a1318))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * setup-tools bumped to 1.2.0

## [1.0.2](https://github.com/abinnovision/actions/compare/app-stack-source-v1.0.1...app-stack-source-v1.0.2) (2026-10-08)


### Bug Fixes

* **app-stack:** run source payload upload in the foreground ([#616](https://github.com/abinnovision/actions/issues/616)) ([dedd326](https://github.com/abinnovision/actions/commit/dedd32617bf2e5126cf913c35d61d058468e30f3))

## [1.0.1](https://github.com/abinnovision/actions/compare/app-stack-source-v1.0.0...app-stack-source-v1.0.1) (2026-10-07)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * exchange-github-token bumped to 1.4.1

## 1.0.0 (2026-10-04)


### Features

* rename app-monorepo-stack to app-stack and support single-package repos ([#608](https://github.com/abinnovision/actions/issues/608)) ([e1c7fe7](https://github.com/abinnovision/actions/commit/e1c7fe7ba688b01c7fa6cac97a6cbc6264915d5a))

## [1.0.1](https://github.com/abinnovision/actions/compare/app-monorepo-stack-source-v1.0.0...app-monorepo-stack-source-v1.0.1) (2026-10-03)


### Bug Fixes

* drop unsupported if from wait steps ([#602](https://github.com/abinnovision/actions/issues/602)) ([a651900](https://github.com/abinnovision/actions/commit/a65190075078184a522c65cb92b978070dd42696))
* name matrix test jobs "Test: &lt;type&gt;" ([#598](https://github.com/abinnovision/actions/issues/598)) ([eda558d](https://github.com/abinnovision/actions/commit/eda558d5690e082bf3fec222bca08acd692e5036))
* run network-bound steps in the background ([#601](https://github.com/abinnovision/actions/issues/601)) ([30e4555](https://github.com/abinnovision/actions/commit/30e4555e764fba8ba1e72fd1193adc60e50867f2))

## 1.0.0 (2026-10-03)


### Features

* align stacks and move publishing into publish workflows ([#590](https://github.com/abinnovision/actions/issues/590)) ([6f689c1](https://github.com/abinnovision/actions/commit/6f689c11d6851ac54b9d092f4f7a0a2fc5e3e740))
* **app-monorepo-stack:** always build before check and document the naming schema ([#594](https://github.com/abinnovision/actions/issues/594)) ([bb6a834](https://github.com/abinnovision/actions/commit/bb6a834c24abc47645db3ffbd7b30d8cfaa0823e))
* **app-monorepo-stack:** run the release in the stack and check out only unit manifests ([#592](https://github.com/abinnovision/actions/issues/592)) ([c910147](https://github.com/abinnovision/actions/commit/c910147f19bd36824a17abb60da4b52bf79578c2))
* pack payloads before the release and select units by pattern ([#591](https://github.com/abinnovision/actions/issues/591)) ([d28702c](https://github.com/abinnovision/actions/commit/d28702cf31afa0a50d544e03654c7a6e9dfe6a64))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * run-release-please bumped to 1.2.0
