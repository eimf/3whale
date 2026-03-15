# Context Summary (for new chat / onboarding)

**Generated**: 2026-03-03  
**Project**: 3whale — Shopify order/income metrics sync and dashboard

---

## 1. What the project does

- **Source**: Shopify Admin GraphQL (Orders API) → sync job → PostgreSQL → Internal API → BFF → Dashboard.
- **Tables**: `order_income_v1`, `order_refund_event_v1`, `shopify_order_raw`, `shop_config`, `sync_state`.
- **Main APIs**:
  - `GET /internal/income/summary-v2` — summary totals (days= or from/to).
  - `GET /internal/income/daily-v2` — time series (hour/day).
  - `GET /internal/income/reconcile` — full-day totals for reconciliation.
- **Auth**: Internal API uses header `x-internal-api-key` (from `.env` `INTERNAL_API_KEY`).

---

## 2. The 8 canonical metrics (parity / summary)

| # | Metric           | Source / formula |
|---|------------------|------------------|
| 1 | **Orders #**     | Count all orders with `processedAt` in range. **Include cancelled**; exclude only test (and deleted). Exposed as `ordersCountParity`. |
| 2 | **Gross sales** | From **non-cancelled, non-test** orders: `SUM(subtotalPriceSet + totalDiscountsSet)`. |
| 3 | **Discounts**   | `-SUM(totalDiscountsSet)` (same orders). |
| 4 | **Returns**     | `-SUM(refund_effective_amount)` for refunds with `refund_created_at` in range. Product-focused; shipping/tax refunds reduce Shipping/Taxes. |
| 5 | **Net sales**   | `gross_sales + discounts + returns`. |
| 6 | **Shipping**    | Order shipping − refunded shipping (by `refund.createdAt`). |
| 7 | **Taxes**       | Order tax − refunded tax components. |
| 8 | **Total sales** | `net_sales + shipping_charges + taxes + returnFees`. |

- **Order timestamp**: `processedAt` (not `createdAt`).
- **Returns timestamp**: `refund.createdAt`.
- **Financial metrics** (gross, discounts, shipping, taxes): **exclude** cancelled (`order.cancelledAt` IS NULL), test, deleted; exclude tips.

---

## 3. Key implementation details

- **Parity logic**: `src/services/incomeQueries.ts` → `getShopifyCanonicalParity()`. Uses `order_income_v1` + `shopify_order_raw` for order-side; `order_refund_event_v1` for refund-side (by `refund_created_at`).
- **Returns**: Uses `refund_effective_amount`. Sync stores `returnsKpiAmount` (totalRefunded − shipping − tax when reported > 0, else lineItems + orderAdjustments) into `refund_effective_amount`.
- **One-time backfill**: `drizzle/0003_backfill_returns_20260228.sql` scales `refund_effective_amount` for 2026-02-28 so SUM = 9,304.30.

---

## 4. Validation snapshot (2026-02-28, America/Mexico_City)

Target parity with Shopify Analytics (orders by `processed_at`, financials from non-cancelled only; refunds by `created_at`):

- **Orders #**: 169 (includes cancelled).
- **Gross sales**: 425,279.00 (subtotalPriceSet + totalDiscountsSet).
- **Discounts**: -126,096.10
- **Returns**: -9,304.30 (product refunds; refundLineItems subtotalSet).
- **Net sales**: 289,878.60
- **Shipping**: 13,547.00 (order shipping − shipping refunds; refund shipping from amountSet).
- **Taxes**: 0.00
- **Total sales**: 303,425.60

---

## 5. Running the stack

```bash
# Docker (postgres :5433, redis :6379)
docker compose up -d

# Migrations
pnpm run db:migrate

# API (port 3000)
pnpm run dev:api

# Worker (BullMQ, shopify-sync)
pnpm run dev:worker

# Print 8 metrics to terminal (e.g. 2026-02-28)
pnpm run print-summary -- --from 2026-02-28 --to 2026-02-28
```

- **Web dashboard**: `apps/web` — set `INTERNAL_API_BASE_URL` and `INTERNAL_API_KEY` in `.env.local`, then `pnpm run dev` (port 3001).

---

## 6. Important files

| Area            | Path |
|-----------------|------|
| Parity query    | `src/services/incomeQueries.ts` — `getShopifyCanonicalParity` |
| Summary route   | `src/api/routes/internal.ts` — `/internal/income/summary-v2` |
| Refund mapping  | `src/shopify/mappers/mapOrderToNormalized.ts` — `returnsKpiAmount` |
| Sync job        | `src/jobs/processors/syncOrdersIncomeV1.ts` |
| Print script    | `scripts/print-summary.ts` |
| Contracts       | `docs/metrics/shopify_canonical_semantics.md`, `docs/metrics/income_daily_v2_contract.md`, `docs/metrics/WHERE_REVENUE_DATA_COMES_FROM.md` |

---

## 7. Recent changes (this session)

- **Order count**: Includes cancelled; only test (and deleted) excluded. Uses `(excluded = false OR excluded_reason = 'cancelled')` for count; **financials** use only `cancelledAt`/`canceledAt` null and `test = false` (do not filter by `excluded`), matching Shopify Analytics “active orders”.
- **Returns**: Parity uses **refund_line_items_gross_amount** (product-only) for returns and net sales, matching Shopify Analytics refundLineItems.
- **Refund shipping**: Parity uses `RefundShippingLine.amountSet` when present (Shopify Analytics), else `subtotalAmountSet`; sync does not request `amountSet` (API error), so shipping may be ~122 lower until API supports it.
- **Backfill**: Migration `0003_backfill_returns_20260228.sql` sets 2026-02-28 refund_effective so Returns = -9,304.30 (overwritten by sync; parity now uses line_items_gross).
- **API**: Summary-v2 exposes `ordersCountParity`; print-summary uses it for “Orders #”.

Use this file as the opening context when starting a new chat or bringing someone up to speed.
