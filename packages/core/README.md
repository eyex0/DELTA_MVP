# DELTA canonical process schema

This package is the authoritative process-graph contract for the main DELTA
monorepo. It provides:

- versioned `ProcessGraphSchema` runtime validation;
- TypeScript types derived from the same Zod definitions;
- a checked-in JSON Schema for external tooling;
- `migrateProcessGraph()` for legacy graphs that predate `schemaVersion`,
  normalized node arrays, metadata defaults, or explicit loop endpoints.

The current contract is version `1.0`. Consumers must persist the version and
must not silently accept a graph that cannot be migrated into this contract.

The standalone `process-intelligence-lab` remains independently runnable. Its
adapter boundary is intentionally separate until the lab can adopt this
contract without changing its benchmark artifacts.
