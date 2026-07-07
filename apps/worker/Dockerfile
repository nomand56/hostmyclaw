FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY apps/worker/package.json ./apps/worker/
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

COPY apps/worker/src ./apps/worker/src
COPY apps/worker/tsconfig.json ./apps/worker/
RUN pnpm --filter @hostmyclaw/worker build

# Prune dev dependencies for production
RUN pnpm prune --prod

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
