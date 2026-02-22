# 3whale – Dev setup (income v1 pipeline)

Single-store Shopify → Postgres sync for income v1. Single source of truth: `docs/metrics/income_v1_contract.md`.

## Stack

Node.js, TypeScript, Fastify, Drizzle + Postgres, BullMQ + Redis, zod, luxon, pino.

## Prerequisites

- Node.js 18+
- Docker (for Postgres + Redis)

## Commands

```bash
# 1. Start infra (Postgres 16, Redis 7)
docker compose up -d

# 2. Create .env with required keys (see src/env.ts):
#    DATABASE_URL, REDIS_URL, INTERNAL_API_KEY,
#    SHOPIFY_SHOP_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN,
#    SHOP_TIMEZONE_IANA, SHOP_CURRENCY_CODE
#    Optional: PORT, SHOPIFY_API_VERSION, SHOPIFY_SYNC_*, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET

# 3. Run migrations
npm run db:migrate

# 4. Terminal 1: start API (port 3000)
npm run dev:api

# 5. Terminal 2: start worker
npm run dev:worker
```

## Test locally (quick run)

After API and worker are running, in a **third terminal** (replace `YOUR_INTERNAL_API_KEY` with the value from your `.env`):

```bash
# Health (no auth)
curl -s http://localhost:3000/internal/health

# Bootstrap shop config from .env
curl -s -X POST http://localhost:3000/internal/bootstrap \
  -H "x-internal-api-key: YOUR_INTERNAL_API_KEY"

# Trigger sync (worker will process last 30 days from Shopify)
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
- Run all: `npm run db:migrate` (currently runs `drizzle/0000_initial_income_v1.sql`).
- If you had an older multi-shop schema, drop the old tables before re-running migrations.

## Acceptance (E2E)

1. `docker compose up` → Postgres + Redis up.
2. Run migrations, then start API and worker.
3. `POST /internal/bootstrap` (with `x-internal-api-key`) → creates/updates `shop_config` and `sync_state`.
4. `POST /internal/sync/run` → enqueues job; worker ingests last 30 days (backfill), writes raw + computed.
5. `GET /internal/income/daily?days=1|2|3|7|30` → daily series (excluded orders omitted; sums as strings).
6. `GET /internal/sync-status` → watermark, run logs, counts.

## Internal API (all require `x-internal-api-key`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /internal/health | No auth; health check |
| POST | /internal/bootstrap | Upsert shop_config from env; ensure sync_state |
| POST | /internal/sync/run | Enqueue sync job; returns `{ jobId }` |
| GET | /internal/sync-status | shop_config, sync_state, last 10 run logs, counts |
| GET | /internal/income/daily?days=1\|2\|3\|7\|30 | Daily income series (strings, excluded=false) |

## Store target (hard requirements)

- `SHOPIFY_SHOP_DOMAIN=f4t3-clo.myshopify.com`
- `SHOP_TIMEZONE_IANA=America/Mexico_City`
- Sync: 30-day initial backfill; overlap 2 days for idempotency.
- Dashboard series: `days` ∈ {1, 2, 3, 7, 30}; orders with `excluded=true` are not summed.
