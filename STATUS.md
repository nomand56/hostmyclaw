# Project Status — HostMyClaw

## What This Project Does

HostMyClaw is a SaaS platform that lets users deploy and manage AI assistants (powered by OpenClaw) as isolated Docker containers. Each customer gets their own container accessible via a unique subdomain, with skills (Gmail, Telegram, Calendar, etc.) injected as environment variables at deploy time.

The platform has two planes:
- **Control Plane** — handles auth, billing, orchestration, and scheduling (Next.js + Fastify + Postgres + Redis)
- **Data Plane** — the per-customer OpenClaw containers, reverse-proxied by Traefik with automatic TLS
---
## What Has Been Done

### Monorepo Foundation
- Initialized pnpm workspace with Turborepo
- Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, base `tsconfig.json`, `.gitignore`, `.env.example`

### `packages/shared`
- `plans.ts` — plan definitions (free / starter / growth / pro) with Stripe price IDs and assistant limits
- `errors.ts` — `AppError` class with code + statusCode for structured error handling
- `crypto.ts` — AES-256-GCM `encryptSecret` / `decryptSecret` using a master key from env
- `ids.ts` — base-62 prefixed ID generator (e.g. `usr_...`, `asst_...`, `job_...`)

### `packages/db`
- Knex client pointed at `DATABASE_URL`
- Full TypeScript types for all tables (`User`, `Assistant`, `Template`, `Skill`, `AssistantSkill`, `AssistantSecret`, `DeploymentJob`, `AssistantLog`, `Subscription`, `PortPool`)
- 7 migrations in order:
  1. `001` — users table + `gen_prefixed_id` Postgres function
  2. `002` — templates + skills tables
  3. `003` — assistants + assistant_skills tables (with indexes)
  4. `004` — assistant_secrets table (encrypted at rest: `value_enc`, `iv`, `auth_tag`)
  5. `005` — deployment_jobs + assistant_logs tables (with indexes)
  6. `006` — subscriptions table
  7. `007` — port_pool table, pre-populated with ports 8100–9099
- Seeds for templates (`tmpl_sales_v1`, `tmpl_support_v1`) and skills (Gmail, Calendar, Telegram, LinkedIn)

### `packages/queue`
- IORedis connection
- Three BullMQ queues: `deployment-queue`, `teardown-queue`, `healthcheck-queue`
- Typed job payloads: `DeployJobPayload`, `TeardownJobPayload`, `StopJobPayload`, `RestartJobPayload`

### `apps/api` — Fastify API Server
- **Plugins**: `db.ts` (Knex), `auth.ts` (@fastify/jwt), `stripe.ts` (Stripe client)
- **Middleware**: `requireAuth` (JWT verify), `assertCanDeploy` (subscription + limit guard)
- **Auth routes** (`/api/v1/auth`):
  - `POST /register` — hashes password (bcrypt), creates user + free subscription, returns JWT
  - `POST /login` — validates credentials, returns JWT
  - `GET /me` — returns authenticated user profile
- **Assistant routes** (`/api/v1/assistants`):
  - `GET /` — list user's assistants
  - `POST /` — create assistant (draft status)
  - `GET /:id` — get single assistant
  - `PATCH /:id` — update name/config
  - `DELETE /:id` — delete + enqueue teardown job
  - `POST /:id/deploy` — allocates port (SELECT FOR UPDATE SKIP LOCKED), enqueues deploy job, returns 202
  - `POST /:id/stop` — enqueues stop job
  - `POST /:id/restart` — enqueues restart job
  - `GET /:id/status` — current status + container info + health
  - `GET /:id/health` — proxies to container `/health`
  - `GET /:id/logs` — paginated logs with cursor + type filter
- **Billing routes** (`/api/v1/billing`):
  - `POST /checkout` — creates Stripe Checkout session
  - `GET /subscription` — returns current subscription
  - `POST /portal` — creates Stripe Customer Portal session
- **Other routes**:
  - `GET /templates` + `GET /templates/:id`
  - `GET /skills` + `GET /skills/:id`
  - `POST /webhooks/stripe` — handles `subscription.created/updated/deleted`, `invoice.payment_failed`

### `apps/worker` — BullMQ Worker Process
- **`deployment.worker.ts`** — processes `deployment-queue` (concurrency: 5, rate-limited to 10/10s)
- **`teardown.worker.ts`** — processes `teardown-queue` (stop + remove container + release port)
- **`healthcheck.worker.ts`** — processes `healthcheck-queue` (runs every 30s via repeatable job)
- **Docker layer** (`src/docker/`):
  - `client.ts` — dockerode instance via Unix socket
  - `containers.ts` — `createAndStartContainer` (with Traefik labels, resource limits), `stopContainer`, `removeContainer`
  - `logs.ts` — streams container stderr into `assistant_logs` table
- **Processors** (`src/processors/`):
  - `deployAssistant.ts` — full deploy flow: build env vars → create container → poll `/health` for 60s → update DB → release port on failure
  - `stopAssistant.ts` — stop container + release port + update status to `stopped`
  - `checkHealth.ts` — polls all running assistants, tracks consecutive failures (3 → mark `failed`)
- **Lib** (`src/lib/`):
  - `portAllocator.ts` — atomic port allocation via Knex transaction + SKIP LOCKED
  - `envBuilder.ts` — decrypts all secrets for an assistant, builds env var map + internal JWT

### `apps/web` — Next.js 14 Frontend
- `src/lib/api.ts` — typed API client (auth, assistants, templates, skills, billing)
- **Auth pages**: `/login`, `/register` (client-side, stores JWT in localStorage)
- **Dashboard** (`/dashboard`): lists assistants, link to create new
- **New assistant wizard** (`/dashboard/assistants/new`): pick name + template + skills
- **Assistant detail** (`/dashboard/assistants/[id]`): shows status, URL, health, deploy/stop buttons, live log tail (polls every 10s)
- **Billing page** (`/dashboard/billing`): shows current plan, upgrade buttons (Stripe Checkout), manage portal link

### Infrastructure
- `infra/docker-compose.yml` — full local stack: Postgres 16, Redis 7, Traefik v3, API, Worker, Web
- `infra/docker-compose.prod.yml` — production overrides (restart policies, log rotation)
- `infra/traefik/traefik.yml` — HTTP→HTTPS redirect, Docker provider, Let's Encrypt ACME
- `infra/traefik/dynamic.yml` — HSTS security headers middleware
- `infra/prometheus/prometheus.yml` — scrapes `/metrics` from API
- `docker/openclaw/Dockerfile` — OpenClaw base image with health check
- `docker/openclaw/entrypoint.sh` — writes `config.json` from env, activates skills, starts server

---

## Current State

**All scaffold files are written. No packages are installed yet.**

The next action is:

```bash
pnpm install
```

This will:
1. Install all dependencies across all workspaces
2. Resolve the TypeScript "cannot find module" errors (fastify, bullmq, etc. are not downloaded yet)
3. Generate the `pnpm-lock.yaml` lockfile

After install, the build order is:

```bash
pnpm --filter @hostmyclaw/shared build   # compile shared package first
pnpm --filter @hostmyclaw/db build       # depends on shared
pnpm --filter @hostmyclaw/queue build    # depends on shared
pnpm --filter @hostmyclaw/api build      # depends on all packages
pnpm --filter @hostmyclaw/worker build   # depends on all packages
```

Or simply:

```bash
pnpm build   # Turborepo handles the order automatically
```

---
## What Still Needs to Be Built
| Area | What's missing |
|---|---|
| **Secret management UI** | Frontend form for entering per-skill secrets (OAuth tokens, bot tokens) and calling `POST /assistants/:id/skills/:skillId/secrets` |
| **Secret API route** | `POST /assistants/:id/skills` to store skill config + encrypted secrets into `assistant_skills` + `assistant_secrets` |
| **Restart processor** | `restartAssistant.ts` — stop then re-deploy with same config |
| **Log streaming** | WebSocket or SSE endpoint to stream logs in real-time instead of polling |
| **Metrics endpoint** | `GET /metrics` on API using `prom-client` (active containers, job counts, request durations) |
| **Web Dockerfile** | Multi-stage Next.js production build image |
| **CI pipeline** | GitHub Actions: typecheck → build → Docker build on push |
| **`fastify-plugin`** | Listed as a dep in API plugins but not in `package.json` — needs to be added |

---

## Environment Setup Checklist

Before running locally, copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — Postgres connection string
- `REDIS_URL` — Redis connection string  
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_JWT_SECRET` — 64-char random hex each
- `SECRET_ENCRYPTION_KEY` — 64-char random hex (AES-256 master key — never commit this)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_*_PRICE_ID` — from Stripe dashboard
- `DOMAIN`, `ASSISTANTS_SUBDOMAIN` — your domain + wildcard subdomain
- `OPENCLAW_IMAGE` — Docker image name for OpenClaw
