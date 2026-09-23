# DELTA Implementation Platform — Base44 Dev Environment

## Project location

The actual project lives in `you-are-working-on-delta/` (a pnpm monorepo). The repo root also contains older phase snapshots (`delta-ai-integration-implementation`, `now-implement-phase-3-*`, `now-implement-phase-4-*`) — ignore those.

## Architecture

- **API**: `artifacts/api-server` — Express 5 on port 3100, bundled with esbuild (`build.mjs`), then run via `node ./dist/index.mjs`. Not a live-reload server; restart the `api` compose service after code changes.
- **Frontend**: `artifacts/delta-platform` — Vite 7 + React 19 on port 5173 (mapped to host 3000). Live reload works for frontend edits.
- **Database**: PostgreSQL 16 via Drizzle ORM (`lib/db`). Schema is pushed with `pnpm --filter @workspace/db run push` during the one-shot `setup` service.
- **Single-origin**: Vite proxies `/api` → `http://api:3100` (added in `vite.config.ts`). The frontend API client uses `/api` as its base URL.

## Setup quirks

- pnpm 9 is required (lockfile v9.0). Each compose service runs `npm i -g pnpm@9` at startup.
- `pnpm-workspace.yaml` enforces `minimumReleaseAge: 1440` (1-day minimum for npm packages). `--frozen-lockfile` bypasses resolution so this doesn't block installs.
- The `preinstall` script in the root `package.json` refuses non-pnpm package managers.
- The `setup` compose service installs all workspace deps and pushes the DB schema before `api` and `web` start (via `depends_on: condition: service_completed_successfully`).
- No external secrets are needed — the app only uses `PORT`, `DATABASE_URL`, and `NODE_ENV`, all provided via compose `environment:`.

## Verification

- `curl http://localhost:3000/` → 200 (frontend HTML)
- `curl http://localhost:3000/api/healthz` → `{"status":"ok"}`
- `curl http://localhost:3000/api/dashboard` → JSON with seeded project data (proves DB + API + proxy all work)
- Frontend renders the DELTA dashboard with navigation and metrics.

## Compose services

| Service | Image | Purpose |
|---------|-------|---------|
| `db` | postgres:16-alpine | PostgreSQL database |
| `setup` | node:22 | One-shot: `pnpm install` + `drizzle-kit push` |
| `api` | node:22 | Express API on port 3100 |
| `web` | node:22 | Vite dev server on port 5173 → host 3000 |
