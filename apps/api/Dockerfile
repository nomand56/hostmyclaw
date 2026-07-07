FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
RUN pnpm --filter @hostmyclaw/shared build

COPY packages/db/src ./packages/db/src
COPY packages/db/tsconfig.json ./packages/db/
RUN pnpm --filter @hostmyclaw/db build

COPY packages/queue/src ./packages/queue/src
COPY packages/queue/tsconfig.json ./packages/queue/
RUN pnpm --filter @hostmyclaw/queue build

COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/
RUN pnpm --filter @hostmyclaw/api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/queue/dist ./packages/queue/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY apps/api/swagger.yaml ./apps/api/swagger.yaml

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
