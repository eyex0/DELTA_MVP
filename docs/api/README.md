# API

The API contract is defined in
[`packages/api-spec/openapi.yaml`](../../packages/api-spec/openapi.yaml)
(OpenAPI 3.1). Validation schemas (`packages/api-zod`) and the React Query
client (`packages/api-client`) are generated from it with orval.

## Conventions

- All endpoints are served under the `/api` base path.
- The server is `apps/api` (Express 5). Route modules live in
  `apps/api/src/routes/`.
- Request/response payloads are validated with generated Zod schemas.
- After changing the spec, run
  `pnpm --filter @workspace/api-spec run codegen` and commit the regenerated
  output.

## Current endpoints

| Method | Path                                              | Purpose                                  |
| ------ | ------------------------------------------------- | ---------------------------------------- |
| GET    | `/api/healthz`                                    | Health check                             |
| GET    | `/api/dashboard`                                  | Dashboard metrics                        |
| GET    | `/api/projects`                                   | List projects                            |
| POST   | `/api/projects`                                   | Create a project                         |
| GET    | `/api/projects/:projectId`                        | Get a project                            |
| PATCH  | `/api/projects/:projectId`                        | Update a project                         |
| POST   | `/api/projects/:projectId/discovery/run`          | Run the discovery step                   |
| GET    | `/api/projects/:projectId/requirements`           | List requirements                        |
| PATCH  | `/api/requirements/:requirementId`                | Update a requirement                     |
| GET    | `/api/projects/:projectId/analysis`              | Get analysis results                     |
| POST   | `/api/projects/:projectId/analysis`              | Run an analysis                          |
| GET    | `/api/projects/:projectId/approvals`              | List approvals                           |
| POST   | `/api/approvals/:approvalId/decision`             | Decide an approval                       |
| GET    | `/api/projects/:projectId/implementation-plan`    | Get the implementation plan              |
| POST   | `/api/projects/:projectId/implementation-plan`    | Generate the implementation plan        |
| GET    | `/api/projects/:projectId/activity`               | List activity events                     |
| GET    | `/api/projects/:projectId/traceability`           | Get requirement traceability             |
