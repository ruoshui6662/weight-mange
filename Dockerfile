FROM node:24.19.0-bookworm-slim AS build

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json vitest.config.ts vitest.integration.config.ts eslint.config.mjs ./
COPY apps ./apps
COPY packages ./packages
COPY tools ./tools
COPY scripts ./scripts

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:24.19.0-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/db/app.sqlite

RUN groupadd --gid 10001 appuser \
  && useradd --uid 10001 --gid 10001 --create-home appuser \
  && mkdir -p /data/db /data/uploads /data/backups /data/imports /data/cache \
  && chown -R appuser:appuser /data

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/web/dist ./web
COPY --from=build /workspace/packages ./packages
COPY --from=build /workspace/scripts/healthcheck.mjs ./scripts/healthcheck.mjs

USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "/app/scripts/healthcheck.mjs"]
ENTRYPOINT ["node", "/app/apps/api/dist/index.js"]
