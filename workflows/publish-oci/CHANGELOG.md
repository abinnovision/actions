# Changelog

## [1.1.1](https://github.com/abinnovision/actions/compare/publish-oci-source-v1.1.0...publish-oci-source-v1.1.1) (2026-10-07)


### Bug Fixes

* **publish-oci:** run buildx setup in the foreground ([#614](https://github.com/abinnovision/actions/issues/614)) ([a07b691](https://github.com/abinnovision/actions/commit/a07b691e42c10168f16977e54a0af52f34df0160))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * exchange-github-token bumped to 1.4.1

## [1.1.0](https://github.com/abinnovision/actions/compare/publish-oci-source-v1.0.1...publish-oci-source-v1.1.0) (2026-10-04)


### Features

* **publish-oci:** add gitops-routes for per-type GitOps routing ([#607](https://github.com/abinnovision/actions/issues/607)) ([112bf66](https://github.com/abinnovision/actions/commit/112bf66c1a448ab4ec827c65658b8d36438d2bde))
* rename app-monorepo-stack to app-stack and support single-package repos ([#608](https://github.com/abinnovision/actions/issues/608)) ([e1c7fe7](https://github.com/abinnovision/actions/commit/e1c7fe7ba688b01c7fa6cac97a6cbc6264915d5a))

## [1.0.1](https://github.com/abinnovision/actions/compare/publish-oci-source-v1.0.0...publish-oci-source-v1.0.1) (2026-10-03)


### Bug Fixes

* drop unsupported if from wait steps ([#602](https://github.com/abinnovision/actions/issues/602)) ([a651900](https://github.com/abinnovision/actions/commit/a65190075078184a522c65cb92b978070dd42696))
* run network-bound steps in the background ([#601](https://github.com/abinnovision/actions/issues/601)) ([30e4555](https://github.com/abinnovision/actions/commit/30e4555e764fba8ba1e72fd1193adc60e50867f2))

## 1.0.0 (2026-10-03)


### Features

* align stacks and move publishing into publish workflows ([#590](https://github.com/abinnovision/actions/issues/590)) ([6f689c1](https://github.com/abinnovision/actions/commit/6f689c11d6851ac54b9d092f4f7a0a2fc5e3e740))
* pack payloads before the release and select units by pattern ([#591](https://github.com/abinnovision/actions/issues/591)) ([d28702c](https://github.com/abinnovision/actions/commit/d28702cf31afa0a50d544e03654c7a6e9dfe6a64))
