# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server build \
    && pnpm --filter @workspace/delta-platform build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3100 \
    FRONTEND_DIST_DIR=/app/frontend

COPY --from=build /app/artifacts/api-server/dist ./dist
COPY --from=build /app/artifacts/delta-platform/dist/public ./frontend

USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3100) + '/api/healthz').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "--enable-source-maps", "/app/dist/index.mjs"]
