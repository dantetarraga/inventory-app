# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @stockpro/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @stockpro/api build \
 && pnpm --filter @stockpro/api deploy --prod --legacy /out \
 && cp -r apps/api/dist apps/api/drizzle /out/

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
# Apply pending migrations, then start the server.
CMD ["sh", "-c", "node dist/migrate.js && node dist/server.js"]
