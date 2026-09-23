# Completion slice

The standalone lab now includes the production-facing interfaces required to
operate Phase 1 through Phase 3 artifacts:

- `createProcessVersion` and `compareVersions` preserve immutable graph
  snapshots and report semantic changes.
- BPMN conformance checks run independently from generic graph validation.
- `createApiServer` exposes `/health`, `/process/parse`, `/process/validate`,
  and `/process/render` without coupling the lab to the parent DELTA product.
- `delta-process serve <port>` provides a local HTTP entry point suitable for
  container or platform hosting.

The API intentionally uses the deterministic adapter by default. Production
deployments select Microsoft Foundry through the existing environment provider
factory and should add authentication, rate limiting, and TLS at the hosting
boundary.
