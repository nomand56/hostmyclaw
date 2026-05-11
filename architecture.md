# SaaS Managed AI Assistants — Implementation-Ready Architecture

---

## 1. Architecture Overview

### System Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        CONTROL PLANE                            │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐   ┌──────────┐  │
│  │ Next.js  │───▶│ Fastify  │───▶│  Redis   │──▶│ BullMQ   │  │
│  │ Frontend │    │ API      │    │ (Queue)  │   │ Workers  │  │
│  └──────────┘    └────┬─────┘    └──────────┘   └────┬─────┘    │
│                       │                               │         │
│                  ┌────▼─────┐                    ┌────▼─────┐  │
│                  │ Postgres │                    │  Docker  │  │
│                  │ (Primary)│                    │  Engine  │  │
│                  └──────────┘                    └────┬─────┘  │
└──────────────────────────────────────────────────────┼─────────┘
                                                       │ creates
┌──────────────────────────────────────────────────────┼─────────┐
│                        DATA PLANE                     │         │
│                                                       │         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────▼───────┐  │
│  │  OpenClaw    │  │  OpenClaw    │  │  OpenClaw            │  │
│  │  user_abc    │  │  user_def    │  │  user_xyz            │  │
│  │  :8001       │  │  :8002       │  │  :8003               │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────────┘  │
└─────────┼────────────────┼────────────────┼──────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │ Traefik reverse proxy
                    *.assistants.domain.com
```

### Control Plane vs Data Plane

| Concern | Control Plane | Data Plane |
|---|---|---|
| Responsibility | Orchestration, billing, auth, scheduling | AI execution, skill running |
| Runtime | Node.js, Postgres, Redis | Docker containers (OpenClaw) |
| Scaling unit | Horizontal (API replicas) | Per-customer container |
| Network | Internal VPC / docker network | Isolated per container |
| Access to secrets | Yes (decrypt + inject) | Receives injected secrets only |

### Inter-Service Communication

- **Frontend → API**: HTTPS REST, JWT in Authorization header
- **API → Redis**: BullMQ job enqueue (`deployment-queue`, `teardown-queue`)
- **Workers → Docker Engine**: Unix socket `/var/run/docker.sock` via `dockerode`
- **Workers → Postgres**: Direct connection (update status, write logs)
- **Traefik → Containers**: HTTP on internal Docker network, routed by label
- **Health Checker**: Cron job polls `/health` on each running container every 30s

---

## 2. API Design

### Base URL: `https://api.yourdomain.com/api/v1`

### Auth Routes

```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
GET    /auth/me
POST   /auth/refresh
```

**POST /auth/register**
```json
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}

// Response 201
{
  "user": {
    "id": "usr_01HXK9...",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-04-28T10:00:00Z"
  },
  "accessToken": "eyJhbGciOiJSUzI1...",
  "refreshToken": "rt_01HXK9..."
}
```

**POST /auth/login**
```json
// Request
{ "email": "user@example.com", "password": "SecurePass123!" }

// Response 200
{
  "accessToken": "eyJhbGciOiJSUzI1...",
  "refreshToken": "rt_01HXK9...",
  "expiresIn": 900
}
```

### Assistant Routes

```
GET    /assistants                    → list user's assistants
POST   /assistants                    → create assistant
GET    /assistants/:id                → get single assistant
PATCH  /assistants/:id                → update name/config
DELETE /assistants/:id                → delete + teardown container
POST   /assistants/:id/deploy         → trigger deployment job
POST   /assistants/:id/stop           → stop container
POST   /assistants/:id/restart        → restart container
GET    /assistants/:id/status         → current status + container info
GET    /assistants/:id/logs           → paginated deployment + runtime logs
GET    /assistants/:id/health         → proxy to container /health
```

**POST /assistants**
```json
// Request
{
  "name": "My Sales Bot",
  "templateId": "tmpl_sales_v1",
  "skills": ["skill_gmail", "skill_calendar", "skill_telegram"],
  "config": {
    "personality": "professional",
    "language": "en"
  }
}

// Response 201
{
  "id": "asst_01HXK9...",
  "name": "My Sales Bot",
  "status": "draft",
  "templateId": "tmpl_sales_v1",
  "skills": ["skill_gmail", "skill_calendar", "skill_telegram"],
  "containerName": null,
  "containerPort": null,
  "url": null,
  "createdAt": "2026-04-28T10:01:00Z"
}
```

**POST /assistants/:id/deploy**
```json
// Request — no body required

// Response 202 (Accepted, async)
{
  "jobId": "job_01HXK9...",
  "assistantId": "asst_01HXK9...",
  "status": "queued",
  "message": "Deployment job queued. Poll /assistants/:id/status for updates."
}
```

**GET /assistants/:id/status**
```json
// Response 200
{
  "assistantId": "asst_01HXK9...",
  "status": "running",
  "containerName": "openclaw_asst01hxk9",
  "containerPort": 8047,
  "url": "https://asst01hxk9.assistants.yourdomain.com",
  "lastHealthCheck": "2026-04-28T10:15:30Z",
  "healthStatus": "healthy",
  "uptimeSince": "2026-04-28T10:05:12Z",
  "deploymentJobId": "job_01HXK9...",
  "error": null
}
```

**GET /assistants/:id/logs**
```json
// Query: ?type=deployment|runtime&limit=50&cursor=<timestamp>

// Response 200
{
  "logs": [
    {
      "id": "log_01HXK9...",
      "assistantId": "asst_01HXK9...",
      "type": "deployment",
      "level": "info",
      "message": "Pulling openclaw:latest image",
      "timestamp": "2026-04-28T10:04:00Z"
    },
    {
      "id": "log_01HXK9a...",
      "type": "runtime",
      "level": "error",
      "message": "Gmail OAuth token expired",
      "timestamp": "2026-04-28T10:14:22Z"
    }
  ],
  "nextCursor": "2026-04-28T10:14:22Z",
  "total": 87
}
```

### Template + Skill Routes

```
GET    /templates              → list all templates
GET    /templates/:id          → template detail with required skills
GET    /skills                 → list available skills
GET    /skills/:id             → skill detail (config fields required)
```

**GET /templates**
```json
{
  "templates": [
    {
      "id": "tmpl_sales_v1",
      "name": "Sales Assistant",
      "description": "Handles lead follow-up, calendar booking, email outreach",
      "recommendedSkills": ["skill_gmail", "skill_calendar", "skill_linkedin"],
      "requiredSkills": ["skill_gmail"],
      "category": "sales",
      "imageUrl": "https://cdn.yourdomain.com/templates/sales.png"
    }
  ]
}
```

**GET /skills**
```json
{
  "skills": [
    {
      "id": "skill_gmail",
      "name": "Gmail",
      "description": "Read and send emails via Gmail",
      "icon": "gmail.svg",
      "configFields": [
        { "key": "oauth_token", "label": "Gmail OAuth Token", "type": "secret", "required": true },
        { "key": "email_address", "label": "Email Address", "type": "string", "required": true }
      ]
    },
    {
      "id": "skill_telegram",
      "name": "Telegram Bot",
      "configFields": [
        { "key": "bot_token", "label": "Telegram Bot Token", "type": "secret", "required": true }
      ]
    }
  ]
}
```

### Billing Routes

```
POST   /billing/checkout          → create Stripe Checkout session
GET    /billing/subscription       → current subscription
POST   /billing/portal             → Stripe Customer Portal session
POST   /webhooks/stripe            → Stripe webhook handler (no auth)
```

---

## 3. Database Schema (PostgreSQL)

### Users

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY DEFAULT gen_prefixed_id('usr'),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  plan          TEXT NOT NULL DEFAULT 'free',  -- free | starter | growth | pro
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Example row:
-- id: usr_01HXK9MZPQRS
-- email: user@example.com
-- plan: starter
-- stripe_customer_id: cus_Pq9xK2jR7mN1
```

### Assistants

```sql
CREATE TABLE assistants (
  id              TEXT PRIMARY KEY DEFAULT gen_prefixed_id('asst'),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  template_id     TEXT REFERENCES templates(id),
  status          TEXT NOT NULL DEFAULT 'draft',
    -- ENUM: draft | queued | creating | running | stopping | stopped | failed
  config          JSONB NOT NULL DEFAULT '{}',
  container_name  TEXT UNIQUE,
  container_id    TEXT,           -- Docker container ID (64-char hash)
  container_port  INT,
  subdomain       TEXT UNIQUE,    -- <subdomain>.assistants.yourdomain.com
  health_status   TEXT DEFAULT 'unknown',  -- healthy | unhealthy | unknown
  last_health_at  TIMESTAMPTZ,
  uptime_since    TIMESTAMPTZ,
  error_message   TEXT,
  deployed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assistants_user_id ON assistants(user_id);
CREATE INDEX idx_assistants_status ON assistants(status);

-- Example row:
-- id: asst_01HXK9MZPQAB
-- user_id: usr_01HXK9MZPQRS
-- name: My Sales Bot
-- status: running
-- container_name: openclaw_asst01hxk9mzpqab
-- container_port: 8047
-- subdomain: asst01hxk9mzpqab
```

### Templates

```sql
CREATE TABLE templates (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  description        TEXT,
  category           TEXT,
  config_defaults    JSONB NOT NULL DEFAULT '{}',
  openclaw_config    JSONB NOT NULL DEFAULT '{}',  -- passed into container
  required_skill_ids TEXT[] NOT NULL DEFAULT '{}',
  recommended_skill_ids TEXT[] NOT NULL DEFAULT '{}',
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Example row:
-- id: tmpl_sales_v1
-- openclaw_config: {"system_prompt": "You are a professional sales assistant...", "model": "gpt-4o"}
```

### Skills

```sql
CREATE TABLE skills (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  icon_url     TEXT,
  config_schema JSONB NOT NULL DEFAULT '[]',
    -- Array of {key, label, type, required}
  openclaw_skill_name TEXT NOT NULL,  -- exact skill ID as OpenClaw expects it
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Example row:
-- id: skill_gmail
-- openclaw_skill_name: gmail
-- config_schema: [{"key":"oauth_token","type":"secret","required":true},{"key":"email_address","type":"string","required":true}]
```

### Assistant Skills (pivot + skill config per assistant)

```sql
CREATE TABLE assistant_skills (
  id           TEXT PRIMARY KEY DEFAULT gen_prefixed_id('askl'),
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  skill_id     TEXT NOT NULL REFERENCES skills(id),
  config       JSONB NOT NULL DEFAULT '{}',  -- non-secret config values
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assistant_id, skill_id)
);

-- Example row:
-- assistant_id: asst_01HXK9MZPQAB
-- skill_id: skill_gmail
-- config: {"email_address": "john@company.com"}  -- secrets stored separately
```

### Secrets (encrypted at rest)

```sql
CREATE TABLE assistant_secrets (
  id           TEXT PRIMARY KEY DEFAULT gen_prefixed_id('sec'),
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  skill_id     TEXT REFERENCES skills(id),
  key          TEXT NOT NULL,       -- e.g. "gmail_oauth_token", "openai_api_key"
  value_enc    BYTEA NOT NULL,      -- AES-256-GCM encrypted
  iv           BYTEA NOT NULL,      -- 12-byte IV
  auth_tag     BYTEA NOT NULL,      -- 16-byte GCM auth tag
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assistant_id, key)
);

CREATE INDEX idx_secrets_assistant_id ON assistant_secrets(assistant_id);
```

### Deployment Jobs

```sql
CREATE TABLE deployment_jobs (
  id           TEXT PRIMARY KEY DEFAULT gen_prefixed_id('job'),
  assistant_id TEXT NOT NULL REFERENCES assistants(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  type         TEXT NOT NULL,  -- deploy | stop | restart | teardown
  status       TEXT NOT NULL DEFAULT 'queued',
    -- queued | processing | completed | failed
  queue_job_id TEXT,           -- BullMQ job ID
  attempt      INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_assistant_id ON deployment_jobs(assistant_id);
CREATE INDEX idx_jobs_status ON deployment_jobs(status);
```

### Assistant Logs

```sql
CREATE TABLE assistant_logs (
  id           TEXT PRIMARY KEY DEFAULT gen_prefixed_id('log'),
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  job_id       TEXT REFERENCES deployment_jobs(id),
  type         TEXT NOT NULL,   -- deployment | runtime | health
  level        TEXT NOT NULL,   -- info | warn | error
  message      TEXT NOT NULL,
  metadata     JSONB DEFAULT '{}',
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logs_assistant_id_timestamp ON assistant_logs(assistant_id, timestamp DESC);
CREATE INDEX idx_logs_type ON assistant_logs(type);
```

### Subscriptions

```sql
CREATE TABLE subscriptions (
  id                      TEXT PRIMARY KEY DEFAULT gen_prefixed_id('sub'),
  user_id                 TEXT NOT NULL REFERENCES users(id) UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  stripe_price_id         TEXT,
  plan                    TEXT NOT NULL DEFAULT 'free',
  status                  TEXT NOT NULL DEFAULT 'active',
    -- active | past_due | canceled | trialing
  assistant_limit         INT NOT NULL DEFAULT 1,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Example row:
-- plan: starter
-- assistant_limit: 1
-- stripe_subscription_id: sub_1OxK9...
```

### Port Pool

```sql
CREATE TABLE port_pool (
  port        INT PRIMARY KEY,
  assistant_id TEXT REFERENCES assistants(id),
  allocated_at TIMESTAMPTZ,
  server_host  TEXT NOT NULL DEFAULT 'localhost'  -- for multi-server later
);

-- Pre-populate on migration:
-- INSERT INTO port_pool (port) SELECT generate_series(8100, 9099);
```

---

## 4. Queue & Worker System

### Queue Setup (BullMQ + Redis)

Three queues:

```
deployment-queue   → create/start containers
teardown-queue     → stop/remove containers
healthcheck-queue  → periodic health polling (cron)
```

### Job Structures

**Deploy Job Payload**
```json
{
  "jobId": "job_01HXK9DEPLOY",
  "type": "deploy",
  "assistantId": "asst_01HXK9MZPQAB",
  "userId": "usr_01HXK9MZPQRS",
  "containerName": "openclaw_asst01hxk9mzpqab",
  "subdomain": "asst01hxk9mzpqab",
  "port": 8047,
  "templateId": "tmpl_sales_v1",
  "skills": ["gmail", "calendar", "telegram"],
  "openclawConfig": {
    "system_prompt": "You are a professional sales assistant...",
    "model": "gpt-4o"
  }
}
```

**Teardown Job Payload**
```json
{
  "type": "teardown",
  "assistantId": "asst_01HXK9MZPQAB",
  "containerName": "openclaw_asst01hxk9mzpqab",
  "port": 8047
}
```

### Queue Flow (Deploy Path)

```
API: POST /assistants/:id/deploy
  │
  ├── Validate: user has active subscription
  ├── Validate: user hasn't exceeded assistant_limit
  ├── Validate: assistant status is draft|stopped|failed
  ├── Allocate port from port_pool (SELECT FOR UPDATE SKIP LOCKED)
  ├── Update assistant: status=queued, container_name, port, subdomain
  ├── Create deployment_jobs row: status=queued
  ├── Enqueue to deployment-queue (BullMQ)
  │     jobId: job_01HXK9...
  │     attempts: 3
  │     backoff: { type: 'exponential', delay: 5000 }
  └── Return 202 { jobId, status: "queued" }

Worker picks up job:
  │
  ├── Mark job status=processing, started_at=NOW()
  ├── Update assistant status=creating
  ├── LOG: "Starting deployment"
  ├── Fetch secrets from assistant_secrets (decrypt AES-256-GCM)
  ├── Build env var map (secrets + config)
  ├── Pull Docker image (if not cached): openclaw:latest
  ├── LOG: "Image ready"
  ├── Create Docker container:
  │     name: openclaw_asst01hxk9mzpqab
  │     image: openclaw:latest
  │     network: assistants-net
  │     port binding: 8047:3000
  │     env: [...all vars...]
  │     labels: [...traefik labels...]
  │     restart_policy: on-failure (max 3)
  ├── Start container
  ├── LOG: "Container started, waiting for health check"
  ├── Poll container /health for up to 60s (every 3s)
  │     On success:
  │       Update assistant: status=running, uptime_since=NOW()
  │       Update job: status=completed, finished_at=NOW()
  │       LOG: "Deployment successful"
  │     On timeout:
  │       Throw error → BullMQ retries
  │
  └── On final failure (all attempts exhausted):
        Update assistant: status=failed, error_message=<last error>
        Release port back to pool
        LOG (level=error): <error details>
        Update job: status=failed
```

### Worker Concurrency

```typescript
// worker/src/queues/deployment.worker.ts
const deploymentWorker = new Worker(
  'deployment-queue',
  deploymentProcessor,
  {
    connection: redis,
    concurrency: 5,          // 5 parallel deployments per worker process
    limiter: {
      max: 10,               // max 10 jobs per 10s (Docker API protection)
      duration: 10_000,
    },
  }
);
```

### Health Check Cron Job

```typescript
// Enqueue once at startup — BullMQ repeatable job
await healthQueue.add(
  'poll-all-assistants',
  {},
  {
    repeat: { every: 30_000 },   // every 30 seconds
    jobId: 'health-poll-singleton',
  }
);

// Worker: fetch all running assistants, HTTP GET /health on each container
// Update last_health_at + health_status in DB
// If 3 consecutive failures → mark status=failed, log error
```

---

## 5. Deployment System

### Port Allocation

```typescript
// Atomic port allocation via SELECT FOR UPDATE SKIP LOCKED
async function allocatePort(db: Knex): Promise<number> {
  return db.transaction(async (trx) => {
    const row = await trx('port_pool')
      .where({ assistant_id: null })
      .forUpdate()
      .skipLocked()
      .first('port');

    if (!row) throw new Error('No ports available');

    await trx('port_pool')
      .where({ port: row.port })
      .update({ assistant_id: 'PENDING', allocated_at: new Date() });

    return row.port;
  });
}
```

### Container Naming Convention

```
Format:  openclaw_<assistantId_lower_alphanumeric>
Example: openclaw_asst01hxk9mzpqab

Subdomain: asst01hxk9mzpqab.assistants.yourdomain.com
```

### Docker Container Creation (via dockerode)

```typescript
import Docker from 'dockerode';
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

async function createAssistantContainer(job: DeployJob, envVars: Record<string, string>) {
  const container = await docker.createContainer({
    name: job.containerName,
    Image: 'openclaw:latest',
    Env: Object.entries(envVars).map(([k, v]) => `${k}=${v}`),
    Labels: {
      'traefik.enable': 'true',
      [`traefik.http.routers.${job.containerName}.rule`]:
        `Host(\`${job.subdomain}.assistants.yourdomain.com\`)`,
      [`traefik.http.routers.${job.containerName}.tls`]: 'true',
      [`traefik.http.routers.${job.containerName}.tls.certresolver`]: 'letsencrypt',
      [`traefik.http.services.${job.containerName}.loadbalancer.server.port`]: '3000',
      'com.yoursaas.assistant-id': job.assistantId,
      'com.yoursaas.user-id': job.userId,
    },
    ExposedPorts: { '3000/tcp': {} },
    HostConfig: {
      NetworkMode: 'assistants-net',
      PortBindings: {
        '3000/tcp': [{ HostPort: String(job.port) }],
      },
      RestartPolicy: { Name: 'on-failure', MaximumRetryCount: 3 },
      Memory: 512 * 1024 * 1024,          // 512MB RAM limit
      CpuPeriod: 100_000,
      CpuQuota: 50_000,                   // 0.5 CPU
    },
  });

  await container.start();
  return container;
}
```

### Traefik Configuration

```yaml
# infra/traefik/traefik.yml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
  websecure:
    address: ":443"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    network: assistants-net
    exposedByDefault: false

certificatesResolvers:
  letsencrypt:
    acme:
      email: ops@yourdomain.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

DNS wildcard required: `*.assistants.yourdomain.com → server IP`

---

## 6. OpenClaw Runtime Management

### Container Startup Flow

```
Docker starts container
  │
  ├── entrypoint.sh reads env vars
  ├── Writes /app/config.json from env vars (OPENCLAW_CONFIG)
  ├── Installs/activates skills listed in OPENCLAW_SKILLS
  ├── Starts OpenClaw server on :3000
  └── Registers /health endpoint
```

### Environment Variables Injected at Deploy Time

```bash
# Core identity
ASSISTANT_ID=asst_01HXK9MZPQAB
TENANT_ID=usr_01HXK9MZPQRS

# OpenClaw runtime config
OPENCLAW_PORT=3000
OPENCLAW_CONFIG='{"system_prompt":"You are a professional sales assistant...","model":"gpt-4o","temperature":0.7}'

# Skills to activate (comma-separated OpenClaw skill names)
OPENCLAW_SKILLS=gmail,calendar,telegram

# OpenAI / LLM key
OPENAI_API_KEY=sk-proj-...

# Per-skill secrets (prefixed by skill name)
GMAIL_OAUTH_TOKEN=ya29.a0...
GMAIL_EMAIL_ADDRESS=john@company.com
CALENDAR_OAUTH_TOKEN=ya29.a0...
TELEGRAM_BOT_TOKEN=7123456789:AAF...

# Callback to control plane (for log shipping)
CONTROL_PLANE_URL=https://api.yourdomain.com
CONTROL_PLANE_TOKEN=internal_<signed_jwt>
```

### OpenClaw entrypoint.sh

```bash
#!/bin/sh
set -e

echo "[entrypoint] Writing config..."
echo "$OPENCLAW_CONFIG" > /app/config.json

echo "[entrypoint] Activating skills: $OPENCLAW_SKILLS"
# OpenClaw reads OPENCLAW_SKILLS env var directly at startup

echo "[entrypoint] Starting OpenClaw on port $OPENCLAW_PORT..."
exec node /app/index.js
```

### Health Check Endpoint (inside container)

```
GET /health

Response 200:
{
  "status": "ok",
  "assistantId": "asst_01HXK9MZPQAB",
  "uptime": 3721,
  "skills": {
    "gmail": "connected",
    "calendar": "connected",
    "telegram": "error: token invalid"
  }
}

Response 503 (if degraded):
{
  "status": "degraded",
  ...
}
```

### Control Plane Health Checker

```typescript
async function checkContainerHealth(assistant: Assistant): Promise<void> {
  const url = `http://localhost:${assistant.containerPort}/health`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = await resp.json();

    await db('assistants').where({ id: assistant.id }).update({
      health_status: resp.ok ? 'healthy' : 'unhealthy',
      last_health_at: new Date(),
    });

    await logEvent(assistant.id, 'health', 'info', JSON.stringify(body));
  } catch (err) {
    await handleHealthFailure(assistant, err);
  }
}
```

---

## 7. Secrets & Security

### Encryption at Rest (AES-256-GCM)

```typescript
// packages/crypto/src/secrets.ts
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const MASTER_KEY = Buffer.from(process.env.SECRET_ENCRYPTION_KEY!, 'hex'); // 32 bytes = 64 hex chars

export function encryptSecret(plaintext: string): { value_enc: Buffer; iv: Buffer; auth_tag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { value_enc: encrypted, iv, auth_tag: cipher.getAuthTag() };
}

export function decryptSecret(value_enc: Buffer, iv: Buffer, auth_tag: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
  decipher.setAuthTag(auth_tag);
  return decipher.update(value_enc) + decipher.final('utf8');
}
```

`SECRET_ENCRYPTION_KEY` — 64-char hex string — stored only in environment (`.env` / Docker secret / cloud secret manager). Never in code or DB.

### Secret Storage Flow

```
User submits skill config with secret fields
  │
  ├── API validates non-empty
  ├── Encrypts each secret field:
  │     encrypt("ya29.a0...") → { value_enc, iv, auth_tag }
  ├── Stores in assistant_secrets table
  └── Returns 201 (never echoes secrets back)

At deploy time (worker):
  ├── SELECT * FROM assistant_secrets WHERE assistant_id = $1
  ├── Decrypt each value in-memory (never written to disk)
  ├── Build env var map
  ├── Pass to docker.createContainer({ Env: [...] })
  └── Env vars exist only in container memory
```

### Network Security

```yaml
networks:
  assistants-net:
    driver: bridge
    internal: false        # containers need outbound internet for skills
  control-net:
    driver: bridge
    internal: true         # API + worker + DB: no external access
```

Containers in `assistants-net` can reach the internet but cannot reach the control-net databases directly.

### Internal Auth Token for Container Callbacks

```typescript
const internalToken = jwt.sign(
  { assistantId, userId, scope: 'callback' },
  process.env.INTERNAL_JWT_SECRET!,
  { expiresIn: '30d' }
);
// Injected as CONTROL_PLANE_TOKEN env var into container
```

---

## 8. Billing Integration (Stripe)

### Plans & Price IDs

```typescript
// packages/shared/src/plans.ts
export const PLANS = {
  free: {
    name: 'Free',
    stripePriceId: null,
    assistantLimit: 0,
    monthlyPrice: 0,
  },
  starter: {
    name: 'Starter',
    stripePriceId: 'price_1OxK9StarterMonthly',
    assistantLimit: 1,
    monthlyPrice: 2900,         // $29/mo in cents
  },
  growth: {
    name: 'Growth',
    stripePriceId: 'price_1OxK9GrowthMonthly',
    assistantLimit: 5,
    monthlyPrice: 7900,
  },
  pro: {
    name: 'Pro',
    stripePriceId: 'price_1OxK9ProMonthly',
    assistantLimit: 999,
    monthlyPrice: 19900,
  },
} as const;
```

### Checkout Flow

```
POST /billing/checkout
  Body: { planId: "starter" }
  │
  ├── Create/fetch Stripe customer (stripe_customer_id on users table)
  ├── stripe.checkout.sessions.create({
  │     customer: stripe_customer_id,
  │     mode: 'subscription',
  │     line_items: [{ price: PLANS[planId].stripePriceId, quantity: 1 }],
  │     success_url: 'https://app.yourdomain.com/dashboard?checkout=success',
  │     cancel_url: 'https://app.yourdomain.com/pricing',
  │     metadata: { userId }
  │   })
  └── Return { checkoutUrl: session.url }
```

### Webhook Handler

```typescript
// apps/api/src/routes/webhooks/stripe.ts
app.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature']!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return res.status(400).send('Invalid signature');
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0].price.id;
      const plan = getPlanByPriceId(priceId);
      await db('subscriptions')
        .insert({
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          plan: plan.name,
          status: sub.status,
          assistant_limit: plan.assistantLimit,
          current_period_start: new Date(sub.current_period_start * 1000),
          current_period_end: new Date(sub.current_period_end * 1000),
          cancel_at_period_end: sub.cancel_at_period_end,
        })
        .onConflict('stripe_subscription_id')
        .merge();

      await db('users')
        .where({ stripe_customer_id: sub.customer as string })
        .update({ plan: plan.name });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await db('subscriptions')
        .where({ stripe_subscription_id: sub.id })
        .update({ status: 'canceled' });
      await handleDowngrade(sub.customer as string);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await db('subscriptions')
        .where({ stripe_subscription_id: invoice.subscription as string })
        .update({ status: 'past_due' });
      break;
    }
  }

  res.status(200).json({ received: true });
});
```

### Deployment Guard

```typescript
async function assertCanDeploy(userId: string): Promise<void> {
  const [sub, runningCount] = await Promise.all([
    db('subscriptions').where({ user_id: userId }).first(),
    db('assistants').where({ user_id: userId, status: 'running' }).count('id as count').first(),
  ]);

  if (!sub || sub.status !== 'active') {
    throw new AppError('SUBSCRIPTION_REQUIRED', 'An active subscription is required to deploy', 403);
  }

  if (Number(runningCount?.count ?? 0) >= sub.assistant_limit) {
    throw new AppError(
      'LIMIT_EXCEEDED',
      `Your ${sub.plan} plan allows ${sub.assistant_limit} running assistant(s)`,
      403
    );
  }
}
```

---

## 9. Logging & Monitoring

### Deployment Logs (written by worker)

```typescript
async function logDeployment(assistantId: string, jobId: string, level: string, message: string) {
  await db('assistant_logs').insert({
    id: generateId('log'),
    assistant_id: assistantId,
    job_id: jobId,
    type: 'deployment',
    level,
    message,
    timestamp: new Date(),
  });
}
```

### Runtime Logs (streamed from Docker API — stderr only for MVP)

```typescript
const container = docker.getContainer(containerId);
const logStream = await container.logs({
  stdout: false,
  stderr: true,
  follow: true,
  timestamps: true,
  tail: 0,
});

docker.modem.demuxStream(logStream, null, stderrStream);
stderrStream.on('data', async (chunk: Buffer) => {
  const line = chunk.toString('utf8').trim();
  if (!line) return;
  await db('assistant_logs').insert({
    assistant_id,
    type: 'runtime',
    level: 'error',
    message: line.slice(0, 2000),
    timestamp: new Date(),
  });
});
```

### Log Retention (7 days)

```sql
-- Run nightly via pg_cron or worker cron job
DELETE FROM assistant_logs
WHERE timestamp < NOW() - INTERVAL '7 days';
```

### Health Monitoring Flow

```
Worker: healthcheck-queue runs every 30s
  │
  ├── SELECT * FROM assistants WHERE status = 'running'
  ├── For each: HTTP GET http://localhost:<port>/health (5s timeout)
  ├── Write result to assistant_logs (type=health)
  ├── Update assistants SET health_status, last_health_at
  └── If 3 consecutive failures:
        Update status=failed, error_message='Health check failed 3 times'
        Log error-level entry
```

### Minimal Observability Stack

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./infra/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
```

**Metrics exposed by API server** (`/metrics` via `prom-client`):
- `http_request_duration_seconds` (labeled by route)
- `deployment_jobs_total{status=completed|failed}`
- `active_containers_total`
- `healthcheck_failures_total`

---

## 10. Folder Structure

```
saas-platform/                        ← monorepo root
├── package.json                      ← workspaces: ["apps/*", "packages/*"]
├── pnpm-workspace.yaml
├── turbo.json
│
├── apps/
│   ├── api/                          ← Fastify API server
│   │   ├── src/
│   │   │   ├── index.ts              ← server bootstrap
│   │   │   ├── plugins/
│   │   │   │   ├── auth.ts           ← JWT verify plugin
│   │   │   │   ├── stripe.ts         ← Stripe client plugin
│   │   │   │   └── db.ts             ← Postgres (Knex) plugin
│   │   │   ├── routes/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── register.ts
│   │   │   │   │   ├── login.ts
│   │   │   │   │   └── me.ts
│   │   │   │   ├── assistants/
│   │   │   │   │   ├── index.ts      ← GET / POST /assistants
│   │   │   │   │   ├── [id].ts       ← GET / PATCH / DELETE
│   │   │   │   │   ├── deploy.ts     ← POST /:id/deploy
│   │   │   │   │   ├── status.ts     ← GET /:id/status
│   │   │   │   │   └── logs.ts       ← GET /:id/logs
│   │   │   │   ├── billing/
│   │   │   │   │   ├── checkout.ts
│   │   │   │   │   ├── subscription.ts
│   │   │   │   │   └── portal.ts
│   │   │   │   ├── templates.ts
│   │   │   │   ├── skills.ts
│   │   │   │   └── webhooks/
│   │   │   │       └── stripe.ts
│   │   │   ├── services/
│   │   │   │   ├── assistantService.ts
│   │   │   │   ├── deploymentService.ts  ← enqueue jobs
│   │   │   │   ├── billingService.ts
│   │   │   │   └── secretService.ts      ← encrypt/store secrets
│   │   │   └── middleware/
│   │   │       ├── requireAuth.ts
│   │   │       └── requireSubscription.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── worker/                       ← BullMQ worker process
│   │   ├── src/
│   │   │   ├── index.ts              ← start all workers
│   │   │   ├── workers/
│   │   │   │   ├── deployment.worker.ts   ← processes deployment-queue
│   │   │   │   ├── teardown.worker.ts     ← processes teardown-queue
│   │   │   │   └── healthcheck.worker.ts  ← processes healthcheck-queue
│   │   │   ├── processors/
│   │   │   │   ├── deployAssistant.ts     ← core deploy logic
│   │   │   │   ├── stopAssistant.ts
│   │   │   │   └── checkHealth.ts
│   │   │   ├── docker/
│   │   │   │   ├── client.ts              ← dockerode instance
│   │   │   │   ├── containers.ts          ← create/start/stop/remove
│   │   │   │   └── logs.ts                ← stream container logs
│   │   │   └── lib/
│   │   │       ├── portAllocator.ts
│   │   │       └── envBuilder.ts          ← decrypt secrets → env map
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── web/                          ← Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/login/
│       │   │   ├── (auth)/register/
│       │   │   └── dashboard/
│       │   │       ├── page.tsx
│       │   │       ├── assistants/
│       │   │       │   ├── new/page.tsx   ← create assistant wizard
│       │   │       │   └── [id]/page.tsx  ← assistant detail + logs
│       │   │       └── billing/page.tsx
│       │   └── lib/
│       │       └── api.ts                 ← typed API client
│       └── package.json
│
├── packages/
│   ├── db/                           ← database layer (Knex + migrations)
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   └── types.ts              ← TypeScript table types
│   │   ├── migrations/
│   │   │   ├── 001_create_users.ts
│   │   │   ├── 002_create_assistants.ts
│   │   │   ├── 003_create_templates_skills.ts
│   │   │   ├── 004_create_secrets.ts
│   │   │   ├── 005_create_jobs_logs.ts
│   │   │   ├── 006_create_subscriptions.ts
│   │   │   └── 007_seed_port_pool.ts
│   │   ├── seeds/
│   │   │   ├── templates.ts
│   │   │   └── skills.ts
│   │   └── package.json
│   │
│   ├── queue/                        ← BullMQ queue definitions
│   │   ├── src/
│   │   │   ├── redis.ts              ← Redis connection
│   │   │   ├── queues.ts             ← deploymentQueue, teardownQueue, healthQueue
│   │   │   └── types.ts              ← job payload types
│   │   └── package.json
│   │
│   └── shared/                       ← shared types + utils
│       ├── src/
│       │   ├── plans.ts              ← plan definitions
│       │   ├── errors.ts             ← AppError class
│       │   ├── crypto.ts             ← encrypt/decrypt helpers
│       │   └── ids.ts                ← prefixed ID generator
│       └── package.json
│
├── docker/
│   └── openclaw/
│       ├── Dockerfile                ← OpenClaw image build
│       └── entrypoint.sh
│
└── infra/
    ├── docker-compose.yml            ← full local stack
    ├── docker-compose.prod.yml       ← production overrides
    ├── traefik/
    │   ├── traefik.yml
    │   └── dynamic.yml
    └── prometheus/
        └── prometheus.yml
```

### Docker Compose (Local Dev)

```yaml
# infra/docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: saasplatform
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: devpassword
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  traefik:
    image: traefik:v3
    command:
      - --configFile=/etc/traefik/traefik.yml
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik:/etc/traefik
      - letsencrypt:/letsencrypt

  api:
    build: ../apps/api
    env_file: .env
    ports:
      - "4000:4000"
    depends_on: [postgres, redis]
    networks: [control-net, default]

  worker:
    build: ../apps/worker
    env_file: .env
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on: [postgres, redis]
    networks: [control-net, assistants-net, default]

networks:
  control-net:
    internal: true
  assistants-net:
    name: assistants-net

volumes:
  pgdata:
  letsencrypt:
```

### Environment Variables Reference

```bash
# .env
DATABASE_URL=postgresql://postgres:devpassword@localhost:5432/saasplatform
REDIS_URL=redis://localhost:6379

JWT_SECRET=<64-char random hex>
JWT_REFRESH_SECRET=<64-char random hex>
INTERNAL_JWT_SECRET=<64-char random hex>
SECRET_ENCRYPTION_KEY=<64-char random hex>   # AES-256 master key

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_GROWTH_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...

OPENCLAW_IMAGE=openclaw:latest
OPENCLAW_NETWORK=assistants-net
DOMAIN=yourdomain.com
ASSISTANTS_SUBDOMAIN=assistants.yourdomain.com
```

---

## Phase 2 MVP Build Order

1. DB migrations + seed templates/skills
2. Auth endpoints (register/login/me)
3. Assistants CRUD (no deployment yet)
4. Secret storage (POST skill config with secrets)
5. BullMQ queues + worker skeleton
6. Docker container create/start/stop in worker
7. Traefik + wildcard DNS setup
8. Health check polling worker
9. Logs API (deployment logs first, runtime stderr second)
10. Stripe checkout + webhooks + deploy guard
11. Frontend wizard: create → pick template → pick skills → enter keys → deploy
