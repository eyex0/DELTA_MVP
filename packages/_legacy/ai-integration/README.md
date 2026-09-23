# DELTA

## Local development

Use two terminals from the repository root:

```sh
pnpm dev:api
pnpm dev:web
```

The API runs on `http://localhost:3100` and the Vite application runs on
`http://localhost:5173`. For a local preview without PostgreSQL, start the API
with `DATABASE_URL=DISABLE_DB`, `DISABLE_DB=true`, and a development
`JWT_SECRET`. Preview data is held in memory and is cleared when the API
restarts.

Once both services are running, verify their boundaries with:

```sh
pnpm smoke:local
```

This checks the unauthenticated API liveness and readiness responses plus the
frontend HTML response. In preview mode, readiness reports
`database: "preview-disabled"`; that does not claim that PostgreSQL, Entra, or
Microsoft Foundry are configured.

## Database validation

Database validation is read-only and intentionally refuses the preview
sentinel:

```sh
pnpm db:validate
pnpm db:test-tenant-context
```

Both commands require a real PostgreSQL `DATABASE_URL`. They do not run
migrations, reset tables, fabricate Drizzle history, or modify RLS policies.
`db:validate` reports required tables, RLS coverage, extensions, the presence
of the Drizzle journal, and the number of public policies. A missing journal or
schema drift must be reviewed using the production migration baseline plan
before any migration command is run.

## Production container

The root `Dockerfile` builds the API and Vite frontend in separate stages and
serves both from the API container. Build and run it with:

```sh
docker build -t delta .
docker run --rm -p 3100:3100 --env-file .env.production delta
```

`.env.production` must be supplied by the deployment environment (never commit
it). At minimum, production startup requires `DATABASE_URL`, `JWT_SECRET`
(32+ characters), `AUTH_PROVIDER=entra` with the four Entra settings,
`AI_PROVIDER` and its provider settings, and `FRONTEND_ORIGIN`. The image
listens on `3100` by default; set `PORT` if the platform requires another port.

## Database migrations

Run migrations from a checkout with the production database URL available to
the command, before starting a new release:

```sh
DATABASE_URL="$DATABASE_URL" DIRECT_DATABASE_URL="$DIRECT_DATABASE_URL" pnpm --filter @workspace/db migrate
```

The migration command is schema-aware and should be run once per database
release, not from every application replica. Do not use `push-force` in
production. For Neon, use the pooled connection URL for application runtime
`DATABASE_URL` and the direct connection URL for migrations
`DIRECT_DATABASE_URL`. Keep both values in the deployment secret store and
never commit them.

## Health

`GET /api/healthz` is the unauthenticated liveness endpoint used by the
container health check. A non-2xx response or connection failure should
remove the instance from service. Health is not a substitute for running
database migrations or validating external AI-provider connectivity.

## NVIDIA provider check

When using NVIDIA NIM, configure these values in the deployment environment
or local `.env` file:

```text
AI_PROVIDER=nvidia
NVIDIA_API_KEY=<real NVIDIA API key>
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=<model available to your NVIDIA account>
```

Run the live provider check without printing the API key:

```sh
pnpm --filter @workspace/ai run check:nvidia
```

The check sends one short request and reports the normalized provider, model,
request ID, latency, and token usage. Do not paste the key into source files,
logs, chat, or Git.
