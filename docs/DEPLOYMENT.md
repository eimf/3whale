# 3whale – Deployment

Prepare and deploy the API, worker, and web app. Use this checklist for production or staging.

**Chosen stack:** client on **Vercel**, backend (API + Worker) and database on **Railway**.

---

## Overview

| Component | Role | Host |
|-----------|------|------|
| **Postgres** | Database (sync + admin_user) | Railway (Postgres plugin) |
| **Redis** | BullMQ job queue | Railway (Redis plugin) |
| **API** | Fastify internal API (port 3000) | Railway service |
| **Worker** | BullMQ worker (sync jobs) | Railway service |
| **Web** | Next.js BFF + UI | Vercel |

The web app talks to the API via server-side env `INTERNAL_API_BASE_URL` and `INTERNAL_API_KEY`. The web app also needs **direct Postgres** (`DATABASE_URL`) for admin login — use the same Railway Postgres URL in Vercel.

---

## 1. Railway (backend + DB)

Create a Railway project and add the following. All services use the **repo root** as root directory (monorepo).

### 1.1 Postgres and Redis

- [ ] In the project, click **+ New** → **Database** → **PostgreSQL**. Railway sets `DATABASE_URL` automatically when you link the service.
- [ ] **+ New** → **Database** → **Redis**. Railway sets `REDIS_URL` when linked.

### 1.2 API service

- [ ] **+ New** → **GitHub Repo** (or deploy from CLI), select this repo.
- [ ] **Settings** → **Root Directory**: leave empty (repo root).
- [ ] **Settings** → **Build Command**: `pnpm install` (or leave default if Nixpacks runs it).
- [ ] **Settings** → **Start Command**: `pnpm run start:api`
- [ ] **Settings** → **Variables**: Link Postgres and Redis so `DATABASE_URL` and `REDIS_URL` are set. Add the rest (see [Backend env vars](#2-backend-api--worker)).
- [ ] **Settings** → Generate a **public domain** for the service (e.g. `your-api.up.railway.app`) and use this URL as `INTERNAL_API_BASE_URL` in Vercel.

### 1.3 Worker service

- [ ] **+ New** → **Empty Service** (or **Clone** from the API service).
- [ ] **Settings** → Connect the **same GitHub repo** and branch; root directory = repo root.
- [ ] **Settings** → **Start Command**: `pnpm run start:worker`
- [ ] **Settings** → **Variables**: Same as API (link Postgres + Redis, add Shopify and `INTERNAL_API_KEY`). Worker does not need `PORT`.

### 1.4 Migrations and admin (once per DB)

From your machine with Railway CLI, or in a one-off shell in the API service:

```bash
# From repo root; DATABASE_URL comes from Railway env
pnpm run db:migrate
ADMIN_EMAIL=admin@yourcompany.com ADMIN_PASSWORD='YourSecurePass1!' pnpm run bootstrap:admin
```

Or use **Railway CLI**: `railway run pnpm run db:migrate`, then bootstrap.

### 1.5 Health check

- [ ] Open `https://<your-api-domain>/internal/health` → expect 200.

---

## 2. Backend (API + Worker)

### If not using Railway Postgres/Redis

If you use external Postgres/Redis instead of Railway’s plugins:

- [ ] **Postgres** – Create a database; note `DATABASE_URL` (same URL for API, worker, and web app auth).
- [ ] **Redis** – Create instance; note `REDIS_URL`.
- [ ] Ensure both are reachable from Railway and from Vercel (for Postgres only).

### Env vars (backend)

Set these on both Railway API and Worker services (and in Vercel for the web vars listed in §3). On Railway, link Postgres/Redis for `DATABASE_URL` / `REDIS_URL`, then add the rest:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes (production) | Set to `production`. |
| `DATABASE_URL` | Yes | Postgres connection string. |
| `REDIS_URL` | Yes | Redis connection string. |
| `INTERNAL_API_KEY` | Yes | Secret; BFF and scripts use it in `x-internal-api-key` header. |
| `PORT` | No | Default 3000 for API. |
| `SHOPIFY_SHOP_DOMAIN` | Yes | e.g. `store.myshopify.com`. |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Yes | `shpat_...` from Shopify. |
| `SHOP_TIMEZONE_IANA` | Yes | e.g. `America/Mexico_City`. |
| `SHOP_CURRENCY_CODE` | Yes | e.g. `MXN`. |
| `SHOPIFY_API_VERSION` | No | Default 2025-04. |
| `SHOPIFY_SYNC_PAGE_SIZE` | No | Default 100. |
| `SHOPIFY_SYNC_OVERLAP_DAYS` | No | Default 2. |
| `SHOPIFY_INITIAL_BACKFILL_DAYS` | No | Default 30. |

Copy from root `.env.example`; never commit real secrets.

### Run migrations (once per DB)

From repo root, with `DATABASE_URL` set:

```bash
pnpm run db:migrate
```

### Bootstrap admin user (once per DB)

From repo root:

```bash
ADMIN_EMAIL=admin@yourcompany.com ADMIN_PASSWORD='YourSecurePass1!' pnpm run bootstrap:admin
```

Use a strong password (see README_DEV for rules). Do not commit these values.

### Start API and worker

Set `NODE_ENV=production` in the environment, then:

```bash
# API (e.g. port 3000)
pnpm run start:api

# Worker (separate process or same host)
pnpm run start:worker
```

On many hosts you configure two services: one run command `pnpm run start:api`, the other `pnpm run start:worker`. Both need the same env (including `DATABASE_URL`, `REDIS_URL`, `INTERNAL_API_KEY`, Shopify vars).

### Health check

- `GET https://your-api-host/internal/health` – no auth; use for load balancer or uptime checks.

---

## 3. Vercel (web app)

Deploy the Next.js app to Vercel. Set **INTERNAL_API_BASE_URL** to your Railway API public URL (e.g. `https://your-api.up.railway.app`).

### Build

From repo root or with Vercel root set to `apps/web`:

```bash
cd apps/web
pnpm install
pnpm run build
```

### Env vars (web app)

Set in the Vercel project **Environment Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_JWT_SECRET` | Yes | Long random string (e.g. `openssl rand -hex 32`). Used to sign/verify JWTs. |
| `DATABASE_URL` | Yes | Same Postgres as backend; used for admin login only. |
| `INTERNAL_API_BASE_URL` | Yes | Full URL of the deployed API (e.g. `https://api.yourdomain.com`). |
| `INTERNAL_API_KEY` | Yes | Same value as backend `INTERNAL_API_KEY` (BFF sends it in `x-internal-api-key`). |

Mark `AUTH_JWT_SECRET`, `DATABASE_URL`, and `INTERNAL_API_KEY` as **secret** / **encrypted** where the host supports it.

### Run production server (if self-hosted)

```bash
pnpm run start
```

Runs Next.js on port 3001 (or `PORT` if set). For Vercel, the platform runs the built app; no need to run `start` yourself.

### Vercel-specific

- **Root directory**: Set to `apps/web` (Vercel monorepo support).
- **Build command**: `pnpm run build` (or `pnpm install && pnpm run build` if root is `apps/web`).
- **Output**: Standard Next.js; no extra config unless you use a custom output (e.g. `output: 'standalone'`).
- **DATABASE_URL**: Use the same Postgres URL as Railway (from the Railway Postgres plugin; copy from Railway dashboard if needed).
- Ensure all four env vars above are set for the production environment.

---

## 4. Post-deploy checks

- [ ] **API**: Open `https://<railway-api-domain>/internal/health` → expect 200.
- [ ] **Web**: Open your Vercel URL → landing page loads.
- [ ] **Login**: Click Login → sign in with the bootstrap admin email/password → redirect to dashboard.
- [ ] **Dashboard**: Dashboard loads; sync controls and metrics call the API (BFF uses `INTERNAL_API_BASE_URL` + `INTERNAL_API_KEY`).
- [ ] **Logout**: Logout clears cookie and redirects to `/login`.

---

## 5. Security checklist

- [ ] `AUTH_JWT_SECRET` is long and random; different per environment.
- [ ] `INTERNAL_API_KEY` is secret; only backend and BFF know it.
- [ ] `DATABASE_URL` is secret; not exposed to the browser.
- [ ] Admin password was set via bootstrap only; not stored in code or in env after bootstrap.
- [ ] In production, auth cookie is `Secure` (HTTPS only); already set when `NODE_ENV=production`.

---

## 6. Optional: Docker for API + Worker

If you run API and worker in your own infra, you can add a `Dockerfile` that installs deps and runs `pnpm run start:api` or `pnpm run start:worker` with env injected at runtime. Postgres and Redis stay external (managed or separate containers). See your host’s docs for running two processes (e.g. two services in Docker Compose or two containers).
