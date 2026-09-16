# syntax=docker/dockerfile:1.7
# lokacia.ge @lokacia/admin (Next.js) production image.
#   docker build -f infra/docker/admin.Dockerfile --build-arg NEXT_PUBLIC_APP_URL=https://lokacia.ge -t ghcr.io/<org>/lokacia-admin .
# NEXT_PUBLIC_* values are inlined at build time → build one image per environment (staging / prod).
# Follow-up (smaller image, ~150 MB): set `output: 'standalone'` in apps/admin/next.config.ts and copy
# .next/standalone + .next/static + public instead of node_modules (see docs/OPERATIONS.md).

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS pruner
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm dlx turbo@2.10.13 prune @lokacia/admin --docker

FROM node:${NODE_VERSION} AS builder
WORKDIR /repo
RUN apk add --no-cache libc6-compat && corepack enable
ENV PNPM_HOME=/pnpm CI=true NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
ARG NEXT_PUBLIC_APP_URL=https://lokacia.ge
ARG NEXT_PUBLIC_CRM_URL=https://crm.lokacia.ge
ARG NEXT_PUBLIC_ADMIN_URL=https://admin.lokacia.ge
ARG NEXT_PUBLIC_MAPTILER_KEY=
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ARG APP_URL=https://lokacia.ge
ARG API_URL=http://api:4000
ENV NODE_ENV=production NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} NEXT_PUBLIC_CRM_URL=${NEXT_PUBLIC_CRM_URL} \
    NEXT_PUBLIC_ADMIN_URL=${NEXT_PUBLIC_ADMIN_URL} NEXT_PUBLIC_MAPTILER_KEY=${NEXT_PUBLIC_MAPTILER_KEY} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY} APP_URL=${APP_URL} API_URL=${API_URL}
RUN pnpm turbo run build --filter=@lokacia/admin... && rm -rf apps/admin/.next/cache

FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
RUN apk add --no-cache libc6-compat tini && addgroup -S lokacia -g 1001 && adduser -S lokacia -u 1001 -G lokacia
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3102 HOSTNAME=0.0.0.0
# Runtime needs next.config.ts, messages/, public/, .next/ and workspace node_modules (next-intl plugin, @next/env).
COPY --from=builder --chown=lokacia:lokacia /repo/ ./
USER lokacia
WORKDIR /app/apps/admin
EXPOSE 3102
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "exec node_modules/.bin/next start -p ${PORT} -H ${HOSTNAME}"]
