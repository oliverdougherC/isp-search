# Web image: Next.js standalone output. No browser or Playwright dependency is installed here.
# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:24.20.0-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .node-version ./
COPY apps ./apps
COPY packages ./packages
COPY tooling ./tooling
COPY tsconfig.base.json tsconfig.json turbo.json ./
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @isp-search/web... build

FROM node:24.20.0-alpine AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /app
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
