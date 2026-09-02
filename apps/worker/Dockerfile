# Worker image: the only image that carries browser dependencies.
# Build from the repository root: docker build -f apps/worker/Dockerfile .
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS base
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
RUN pnpm --filter @isp-search/worker... build
RUN pnpm --filter @isp-search/worker --prod deploy /out

FROM base AS runtime
ENV NODE_ENV=production
USER pwuser
WORKDIR /app
COPY --from=build --chown=pwuser:pwuser /out ./
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s CMD node dist/main.js health || exit 1
CMD ["node", "dist/main.js", "start"]
