# syntax=docker/dockerfile:1.7
# lokacia.ge API + BullMQ worker + migrations (one image, three commands).
#   docker build -f infra/docker/api.Dockerfile -t ghcr.io/<org>/lokacia-api .
#   api:     (default CMD)            node apps/api/dist/src/main.js
#   worker:  command: ["node", "apps/api/dist/src/worker.js"]
#   migrate: docker build --target migrate …  → pnpm db:migrate

ARG NODE_VERSION=24-alpine

# ---------- 1. prune the monorepo to what @lokacia/api needs ----------
FROM node:${NODE_VERSION} AS pruner
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm dlx turbo@2.10.13 prune @lokacia/api @lokacia/db --docker

# ---------- 2. install (cached on lockfile) + build ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /repo
RUN apk add --no-cache libc6-compat python3 make g++ && corepack enable
ENV PNPM_HOME=/pnpm CI=true TURBO_TELEMETRY_DISABLED=1
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@lokacia/api...

# ---------- 3. one-shot migrations (full deps: tsx + drizzle) ----------
FROM builder AS migrate
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@lokacia/db", "migrate"]

# ---------- 4. production dependencies only ----------
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /repo
RUN apk add --no-cache libc6-compat python3 make g++ && corepack enable
ENV PNPM_HOME=/pnpm CI=true
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

# ---------- 5. runtime ----------
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
RUN apk add --no-cache libc6-compat tini && addgroup -S lokacia -g 1001 && adduser -S lokacia -u 1001 -G lokacia
ENV NODE_ENV=production PORT=4000 NODE_OPTIONS=--enable-source-maps
COPY --from=prod-deps --chown=lokacia:lokacia /repo/ ./
# compiled workspace packages + api
COPY --from=builder --chown=lokacia:lokacia /repo/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder --chown=lokacia:lokacia /repo/packages/db/dist ./packages/db/dist
COPY --from=builder --chown=lokacia:lokacia /repo/packages/db/drizzle ./packages/db/drizzle
COPY --from=builder --chown=lokacia:lokacia /repo/packages/ai/dist ./packages/ai/dist
COPY --from=builder --chown=lokacia:lokacia /repo/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=lokacia:lokacia /repo/apps/api/assets ./apps/api/assets
# repoRoot() looks for pnpm-workspace.yaml; local storage driver writes under /app/storage (use STORAGE_DRIVER=s3 in prod)
RUN mkdir -p /app/storage && chown lokacia:lokacia /app/storage
USER lokacia
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/v1/health >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/src/main.js"]
