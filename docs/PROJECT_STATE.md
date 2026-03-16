# 3whale – Project state

**3whale** is a **single-store Shopify → Postgres income pipeline** for “income v1”: it syncs orders and refunds from Shopify, computes daily income metrics (bruto/neto, refunds, shipping, etc.), and exposes them via an internal API and a Next.js dashboard. The metrics contract is defined in `docs/metrics/income_v1_contract.md`; the canonical daily series API is in `docs/metrics/income_daily_v2_contract.md`.

---

## Architecture

| Layer        | Tech                 | Location                    |
| ------------ | -------------------- | --------------------------- |
| **Backend API** | Fastify, TypeScript   | `src/api/` (port 3000)      |
| **Worker**      | BullMQ + Redis        | `src/jobs/` (sync jobs)     |
| **DB**          | Drizzle + Postgres 16| `src/db/`, `drizzle/*.sql`  |
| **Web app**     | Next.js (App Router)  | `apps/web/` (port 3001)     |
| **Infra**       | Docker Compose        | Postgres + Redis locally    |

Single store is assumed: `SHOPIFY_SHOP_DOMAIN` + `SHOPIFY_ADMIN_ACCESS_TOKEN`. Timezone and currency are intended to come from Shopify at bootstrap (no `SHOP_TIMEZONE_IANA` / `SHOP_CURRENCY_CODE` in env).

---

## Main flows

1. **Bootstrap** (`POST /internal/bootstrap`): Upserts `shop_config` and ensures `sync_state`. Can use new `fetchShopConfigFromShopify()` to get timezone/currency from Shopify `shop.json` instead of env.
2. **Sync** (`POST /internal/sync/run`): Enqueues a job; worker pulls orders/refunds (GraphQL), maps to normalized income, writes to `shopify_order_raw`, `order_income_v1`, `order_refund_event_v1`, and run logs. Optional `?fullSync=true` resets watermark and re-fetches last 90 days.
3. **Daily income** (`GET /internal/income/daily?days=1|2|3|7|14|30|90|365`): Returns daily series (strings; excluded orders omitted).
4. **Web app**: Login (JWT + `admin_user` in Postgres), dashboard with charts/sparklines, sync controls, and BFF routes that proxy to the backend using `INTERNAL_API_KEY`.

---

## Repo layout (high level)

- **`src/`** – API server, internal routes, jobs/queues/processors, DB access, Shopify client/mappers, metrics (money, income components), services (queries, date ranges, comparison, hourly buckets).
- **`apps/web/`** – Next.js app: marketing/landing, login, dashboard, BFF APIs for income and sync.
- **`drizzle/`** – Migrations (initial income v1, refund events, backfill, new metrics).
- **`docs/`** – Deployment, metrics contracts, reconciliation notes, agent/context docs.
- **`scripts/`** – Migrations, admin bootstrap, debug/print/diagnose scripts.

---

## Current git state (in progress)

- **Modified:** `README_DEV.md`, `docs/DEPLOYMENT.md`, `docs/metrics/WHERE_REVENUE_DATA_COMES_FROM.md`, `src/api/routes/internal.ts`, `src/env.ts`.
- **New (untracked):** `src/shopify/client/fetchShopConfig.ts`.

So the **current work** is: **bootstrap from Shopify** — `fetchShopConfig.ts` gets timezone and currency from Shopify’s REST `shop.json`; `internal.ts` uses it in bootstrap; `env.ts` no longer requires `SHOP_TIMEZONE_IANA` / `SHOP_CURRENCY_CODE`; docs are being updated to match (README_DEV, DEPLOYMENT, WHERE_REVENUE_DATA_COMES_FROM).

---

## Deployment

- **Backend (API + worker):** Railway (same repo root; Postgres + Redis as plugins or external).
- **Web:** Vercel; needs `INTERNAL_API_BASE_URL`, `INTERNAL_API_KEY`, `DATABASE_URL` (for auth), `AUTH_JWT_SECRET`.

---

## Summary

The project is a focused income-v1 pipeline with a defined metrics contract, internal API, worker, and dashboard, with bootstrap currently being switched to use Shopify-derived shop config instead of env-based timezone/currency.
