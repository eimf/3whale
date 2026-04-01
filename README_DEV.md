# 3whale – Dev setup (income v1 pipeline)

Single-store Shopify → Postgres sync for income v1. Single source of truth: `docs/metrics/income_v1_contract.md`.

Daily series API contract (canónico): `docs/metrics/income_daily_v2_contract.md`.

## Stack

Node.js, TypeScript, Fastify, Drizzle + Postgres, BullMQ + Redis, zod, luxon, pino. Web: Next.js (App Router) in `apps/web`.

## Prerequisites

- Node.js 18+
- pnpm (recommended; the repo uses pnpm — lockfiles: `pnpm-lock.yaml`)
- Docker (for Postgres + Redis)

## Backend

```bash
# 1. Start infra (Postgres 16, Redis 7)
docker compose up -d

# 2. Create .env with required keys (see src/env.ts):
#    DATABASE_URL, REDIS_URL, INTERNAL_API_KEY,
#    SHOPIFY_SHOP_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN
#    Optional: PORT, SHOPIFY_API_VERSION, SHOPIFY_SYNC_*, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
#    (Timezone and currency are fetched from Shopify API at bootstrap; no SHOP_TIMEZONE_IANA / SHOP_CURRENCY_CODE needed.)

# 3. Run migrations
pnpm run db:migrate

# 4. Terminal 1: start API (port 3000)
pnpm run dev:api

# 5. Terminal 2: start worker
pnpm run dev:worker
```

## Web frontend (apps/web)

```bash
cd apps/web
pnpm install
# Create .env.local with:
#   AUTH_JWT_SECRET (required — long random string for JWT signing)
#   DATABASE_URL (required for login — same Postgres as backend)
#   INTERNAL_API_BASE_URL (e.g. http://localhost:3000), INTERNAL_API_KEY
pnpm run dev
```

- Dev server: **http://localhost:3001**
- Dashboard: **http://localhost:3001/dashboard**

**Vercel deployment:** Set environment variables in the project:

- `INTERNAL_API_BASE_URL` – URL of the deployed backend API (e.g. `https://your-api.vercel.app`).
- `INTERNAL_API_KEY` – set as a **secret**; never exposed to the browser. The BFF route `/api/income/daily` proxies to the backend with this key server-side only.

## Test locally (quick run)

After API and worker are running, in a **third terminal** (replace `YOUR_INTERNAL_API_KEY` with the value from your `.env`):

```bash
# Health (no auth)
curl -s http://localhost:3000/internal/health

# Bootstrap shop config from .env
curl -s -X POST http://localhost:3000/internal/bootstrap \
  -H "x-internal-api-key: YOUR_INTERNAL_API_KEY"

# Trigger sync (worker: incremental from watermark, or initial backfill from env)
curl -s -X POST http://localhost:3000/internal/sync/run \
  -H "x-internal-api-key: YOUR_INTERNAL_API_KEY"

# Check sync status and counts
curl -s http://localhost:3000/internal/sync-status \
  -H "x-internal-api-key: YOUR_INTERNAL_API_KEY"

# Daily income series (after sync has run)
curl -s "http://localhost:3000/internal/income/daily?days=7" \
  -H "x-internal-api-key: YOUR_INTERNAL_API_KEY"
```

## Migrations

- Migrations are plain SQL in `drizzle/*.sql`.
- Run all from repo root: `pnpm run db:migrate`. This runs all numbered SQL files including `admin_user` (for web app login).
- If you had an older multi-shop schema, drop the old tables before re-running migrations.

## Admin user bootstrap (web app login)

To create or update the single admin user used by `apps/web` login:

```bash
# From repo root; set env vars (or use .env)
ADMIN_EMAIL=your@email.com ADMIN_PASSWORD='YourSecurePass1!' pnpm run bootstrap:admin
```

- Reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `DATABASE_URL` from the environment.
- Password rules: min 8, max 15 chars; at least one uppercase, one number, one special character; no spaces.
- Stores an argon2id hash in `admin_user`; safe to run again to change password. Do **not** commit credentials.

## Web app auth (apps/web)

- In `apps/web`, set `AUTH_JWT_SECRET` (required) and `DATABASE_URL` (required for login) in `.env.local` or your deployment.
- After migrations and bootstrap, open the web app → **Login** → sign in with the admin email/password.
- **Logout** in the dashboard clears the session and redirects to `/login`.

## Acceptance (E2E)

1. `docker compose up` → Postgres + Redis up.
2. Run migrations, then start API and worker.
3. `POST /internal/bootstrap` (with `x-internal-api-key`) → creates/updates `shop_config` and `sync_state`.
4. `POST /internal/sync/run` → enqueues job; worker ingests last 30 days (backfill), writes raw + computed.
5. `GET /internal/income/daily?days=1|2|3|7|30` → daily series (excluded orders omitted; sums as strings).
6. `GET /internal/sync-status` → watermark, run logs, counts.

## Internal API (all require `x-internal-api-key`)

| Method | Path                                       | Description                                       |
| ------ | ------------------------------------------ | ------------------------------------------------- |
| GET    | /internal/health                           | No auth; health check                             |
| POST   | /internal/bootstrap                        | Upsert shop_config from env; ensure sync_state    |
| POST   | /internal/sync/run                         | Enqueue sync job; returns `{ jobId }`. Incremental from watermark (initial backfill per `SHOPIFY_INITIAL_BACKFILL_DAYS`). |
| GET    | /internal/sync-status                      | shop_config, sync_state, last 10 run logs, counts |
| GET    | /internal/income/daily?days=1\|2\|3\|7\|30 | Daily income series (strings, excluded=false)     |

## Deployment

See **docs/DEPLOYMENT.md** for production checklist: env vars, migrations, bootstrap, API/worker start commands, and web app (e.g. Vercel).

## Store target (hard requirements)

- `SHOPIFY_SHOP_DOMAIN=f4t3-clo.myshopify.com` (timezone/currency come from Shopify at bootstrap)
- `SHOP_TIMEZONE_IANA=America/Mexico_City`
- Sync: 30-day initial backfill; overlap 2 days for idempotency.
- Dashboard series: `days` ∈ {1, 2, 3, 7, 30}; orders with `excluded=true` are not summed.
