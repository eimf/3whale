# Where revenue data comes from (and why it can differ from Shopify)

You see **180,019.35** in Shopify for “today’s revenue”. Here’s exactly where the app gets its number and why it might not match.

---

## 1. Source of truth: Shopify → our DB → API → dashboard

```
Shopify Admin GraphQL (Orders API)
        ↓
  Sync job: syncOrdersIncomeV1
  (fetches orders by processed_at, maps + computes, upserts)
        ↓
  PostgreSQL: order_income_v1
        ↓
  Internal API: /internal/income/daily-v2, /internal/income/summary-v2
        ↓
  BFF: /api/income/daily, /api/income/summary
        ↓
  Dashboard (cards use summary.*.display; charts use daily .raw)
```

- **Shopify**: Orders are fetched via the **OrdersForIncomeV1** GraphQL query (`src/shopify/graphql/ordersForIncomeV1.graphql`). Sync runs on a schedule or via `POST /internal/sync/run`; it uses a watermark on `processed_at` and writes/updates rows in `order_income_v1`.
- **DB**: Each row in `order_income_v1` is one order: `income_bruto`, `refunds`, `income_neto`, etc., plus `excluded` / `excluded_reason`.
- **API**: Daily and summary endpoints **only include orders where `excluded = false`** and filter by `processed_at` in UTC, then bucket by **shop timezone** (see below).
- **Dashboard**: “Revenue” is **incomeBruto** (gross income before refunds). Cards show the **summary** for the selected range (e.g. “Last 30 days”); no client-side totals.

So the number you see is **not** live from Shopify; it’s the last synced state from Shopify, filtered and aggregated by our rules.

---

## 2. How “revenue” (incomeBruto) is defined in the app

In this codebase, **revenue** shown on the dashboard = **income_bruto**:

- **Per order** (see `src/metrics/computeIncomeComponents.ts` and contract `docs/metrics/income_v1_contract.md`):
  - **income_bruto** = **lineItemsSubtotal + shippingAmount**
  - **Tax is excluded** (we report tax separately; it is not part of income).
  - Subtotal is **after discounts**: we use Shopify’s `currentSubtotalPriceSet.shopMoney` (and `currentShippingPriceSet.shopMoney`), which Shopify already nets of discounts.

So:

- **In the app**: Revenue = (current subtotal after discounts + shipping) in shop currency, **no tax**.
- **In Shopify**: Different reports can use different definitions (e.g. “Total sales” might include tax, or use a different date/timezone). We do **not** use the Analytics API; we only use the Orders GraphQL and our own formulas.

If Shopify’s “today’s revenue” (180,019.35) is “total sales including tax” or “total paid”, our number will be **lower** because we subtract tax from the concept of income.

---

## 3. How “today” and the range are defined

- **Shop timezone**: Stored in `shop_config.timezone_iana` (e.g. `America/Mexico_City`). Used for:
  - Turning `processed_at` (UTC) into a **local date** for “today” and for daily buckets.
  - Summary/daily ranges: “today” = the current calendar day in that timezone.
- **Daily/summary range**: For “Last N days” we use **shop timezone** from `shop_config.timezone_iana`:
  - **end** = **now** in shop TZ (so “today” = “today so far”, not full calendar day)
  - **start** = start of day N days ago in shop TZ  
  So “today” in the app is the current calendar day in `shop_config.timezone_iana` from 00:00:00 up to the current moment. For a full-day window (e.g. to reconcile with Shopify), use `from`/`to` with the same date so the backend uses `parseLocalDateRangeToUtc`, which sets **end** = end of that day in shop TZ.

If Shopify’s 180,019.35 is for “today” in a different timezone (e.g. UTC) or for a different “day” definition (e.g. order date vs payment/processed date), the **set of orders** will differ and the totals will not match.

---

## 4. Which orders are included

We **exclude** orders from all income aggregates (daily and summary) when:

- **Cancelled**: `Order.canceledAt` is set.
- **Test**: `Order.test === true`.
- **Fully refunded**: total refunds ≥ income_bruto for that order (we then exclude the whole order).

So our revenue is **only** from non-cancelled, non-test, not-fully-refunded orders. If Shopify’s report includes test or cancelled orders, or counts fully refunded orders differently, the numbers will differ.

---

## 5. Sync lag

The app does **not** call Shopify on every page load. It shows whatever is in `order_income_v1`, which was last updated by the sync job. If “today” has new orders or refunds in Shopify that haven’t been synced yet, our “today” total will be lower (or different) than 180,019.35.

---

## 6. Quick checklist: why app revenue ≠ 180,019.35

| Cause | What to check |
|-------|----------------|
| **Definition** | Shopify’s report: does it include **tax**? We don’t. |
| **Date / timezone** | Same “today” in the same timezone? Our “today” = current day in `shop_config.timezone_iana`. |
| **Exclusions** | We exclude cancelled, test, and 100% refunded orders. Does Shopify’s report do the same? |
| **Sync** | When did sync last run? Compare `sync_state.last_sync_finished_at` and recent orders in DB. |
| **Which report** | Match against the same Shopify report (e.g. “Total sales” / “Ventas totales”) and same date range. |

---

## 7. Code references (for “revenue” = incomeBruto)

- **GraphQL fields**: `src/shopify/graphql/ordersForIncomeV1.graphql` — subtotal + shipping (shopMoney).
- **Mapping**: `src/shopify/mappers/mapOrderToNormalized.ts` — builds normalized order from GraphQL node.
- **Formula**: `src/metrics/computeIncomeComponents.ts` — `income_bruto = lineItemsSubtotal + shippingAmount`.
- **Exclusions**: `src/metrics/computeIncomeComponents.ts` — `shouldExcludeOrderV1` (cancelled, test, fully refunded).
- **Sync**: `src/jobs/processors/syncOrdersIncomeV1.ts` — fetches orders, maps, computes, upserts into `order_income_v1`.
- **Daily/Summary**: `src/api/routes/internal.ts` — daily-v2 and summary-v2 filter `excluded = false` and bucket by `(processed_at AT TIME ZONE <tz>)::date`.

If you tell me exactly which report and date range in Shopify shows 180,019.35 (and whether it includes tax), we can align the definition or add a reconciliation note in the app.

---

## 8. Why “Last 30 days” doesn’t match Shopify’s dashboard

Shopify’s overview shows **30-day** totals, for example:

| Shopify (30-day)   | Value (example) | Our metric (summary-v2, days=30) |
|--------------------|-----------------|----------------------------------|
| **Order Revenue**  | MX$6,428,881    | Closest: **incomeNeto** (net after refunds) |
| **Returns**       | MX$250,672      | **refunds**                      |
| **Gross Sales**   | MX$33,604,680   | We don’t have this (we use subtotal *after* discounts + shipping) |
| **Orders**        | 3,160           | **ordersIncluded**              |
| **Discounts**     | MX$27,459,228   | **discountAmount** (reported only; our revenue is already after discounts) |
| **Taxes**         | MX$0            | **taxAmount**                   |

Important: in our app the **“Revenue”** card shows **incomeBruto** (gross before refunds). Shopify’s **“Order Revenue”** is **net sales** (after returns/deductions). So you are comparing:

- **App “Revenue”** = income_bruto (before refunds, after discounts, no tax).
- **Shopify “Order Revenue”** = net sales (after refunds, after discounts).

So the same period can differ for these reasons:

1. **Different metric**
   - For a like‑for‑like with **Shopify “Order Revenue”**, compare Shopify’s number to our **Net Profit** (incomeNeto), not Revenue (incomeBruto).
   - Rough check: **incomeBruto** ≈ Order Revenue + Returns; **incomeNeto** ≈ Order Revenue (if definitions align).

2. **Order set**
   - We **exclude** cancelled, test, and 100% refunded orders. Shopify may include some of these or count “Orders > $0” (3,143) differently.
   - So **ordersIncluded** (ours) can be lower than Shopify’s “Orders” (3,160).

3. **30‑day window**
   - We use: **end** = end of “today” in **shop timezone**, **start** = start of day 29 days ago in shop timezone. So “last 30 days” = 30 calendar days in `shop_config.timezone_iana`.
   - Shopify may use a different timezone or “rolling 30 days” (e.g. last 30 × 24 hours in UTC). That can change which orders fall in the range.

4. **Sync**
   - Our numbers are from the last sync. If the sync is behind, our 30‑day totals will not include the latest orders/refunds and will not match Shopify.

5. **Definition of subtotal**
   - We use Shopify’s **currentSubtotalPriceSet.shopMoney** (after discounts) + **currentShippingPriceSet.shopMoney**. We do **not** use Gross Sales (before discounts). So our revenue is in the “after discounts” world, which is the right side to compare to **Order Revenue**, but rounding or edge cases can still cause small differences.

### How to debug a 30‑day mismatch

1. Call **`GET /internal/income/summary-v2?days=30`** (with your auth). You get:
   - **incomeBruto**, **incomeNeto**, **refunds**, **ordersIncluded**, **range.from**, **range.to**, **range.timezone**.
2. Compare:
   - **incomeNeto** ↔ Shopify **Order Revenue** (MX$6,428,881).
   - **incomeBruto** ↔ Order Revenue + Returns (≈ 6,428,881 + 250,672).
   - **ordersIncluded** ↔ Shopify **Orders** (3,160) or **Orders > $0** (3,143).
3. Confirm **range.from** and **range.to** are the same 30 days you have selected in Shopify (and same timezone).
4. Check **sync_state**: when did `last_sync_finished_at` run? If it’s old, run a sync and compare again.

---

## 9. Reconciliation recipe: “Today” income vs Shopify

To verify that our “today” income matches Shopify for the same window:

1. **Get our window and totals (with exact UTC bounds)**  
   Call **`GET /internal/income/summary-v2?days=1&debug=1`** (with `x-internal-api-key`). You get:
   - **range**: `from`, `to`, `timezone` (e.g. `America/Mexico_City`)
   - **window_utc**: `start`, `end` (ISO 8601) — the exact UTC bounds used for the DB filter
   - **ordersIncluded**, **incomeNeto**, **incomeBruto**, **refunds**, etc.

2. **Reconcile full calendar “today” (optional)**  
   For the **full** calendar day in shop TZ (00:00–23:59:59), call:
   - **`GET /internal/income/reconcile?from=YYYY-MM-DD&to=YYYY-MM-DD`** with the same date (e.g. today in Mexico). Response includes `totals`, `counts`, and `range.timezone`.

3. **Compare to Shopify**  
   - **Order Revenue** (Shopify) ≈ our **incomeNeto** (net after refunds).  
   - **Gross Sales** (Shopify) ≈ our **incomeBruto** + **discountAmount** (we use subtotal after discounts; Gross Sales is before discounts).  
   - Use the same date range: in Shopify, filter by “Today” or the same date in the store’s timezone. Use **processed_at** / payment date, not order created date.

4. **Currency**  
   All our totals are in **shop currency** (`currencyCode` from summary). Ensure Shopify’s report is in the same currency (e.g. MXN).

---

## 10. Dashboard alignment with Shopify (Today / Total sales breakdown)

The app dashboard is aligned with Shopify Analytics terminology and layout so you can compare like-for-like:

| Shopify term        | App label (es-MX)     | Our field      | Notes |
|---------------------|------------------------|----------------|-------|
| **Total sales**     | Ventas totales        | incomeBruto     | Net sales + shipping + taxes (we exclude tax from income; tax shown separately). |
| **Net sales**       | Ventas netas          | incomeNeto     | Total sales − returns. |
| **Returns**         | Devoluciones          | refunds        | Sum of refunds. |
| **Discounts**       | Descuentos            | discountAmount | Shown in breakdown; revenue is already after discounts. |
| **Shipping charges**| Envío                 | shippingAmount | |
| **Taxes**           | Impuestos             | taxAmount      | |
| **Orders**          | Órdenes totales       | ordersIncluded | Excludes cancelled, test, 100% refunded. |
| **AOV**             | AOV                   | aovNeto        | Net sales / orders. |

- **Total sales breakdown**: The dashboard has a “Desglose de ventas totales” section with the same order as Shopify (Total sales, Discounts, Returns, Net sales, Shipping, Taxes).
- **Range**: When you select “Last 1 day”, the label shows “Hoy (YYYY-MM-DD)” so it’s clear you’re comparing to Shopify’s “Today” in store local time.
- **Source**: Data still comes from the last sync (Orders API → `order_income_v1`); date bucketing uses `shop_config.timezone_iana`. To match Shopify “Today” exactly, ensure sync is up to date and timezone is correct.

---

## 11. “Today” income mismatch — root cause and code pointers

**Why the “today” number can be wrong:**

| Cause | What to check | Code location |
|-------|----------------|----------------|
| **Metric mismatch** | Dashboard “Order Revenue” should match Shopify’s **Order Revenue** = net sales. Our **incomeNeto** = net after refunds; **incomeBruto** = gross. If the first card shows incomeBruto, it will not match Shopify “Order Revenue”. | First card: `apps/web/src/app/dashboard/page.tsx` (use `summary.incomeNeto` for Order Revenue). |
| **Date window** | “Today” must be the current calendar day in **shop timezone** (`shop_config.timezone_iana`). For `days=1`, end = **now** in shop TZ, not end of day. | `src/api/routes/internal.ts`: summary-v2 and daily-v2 use `DateTime.now().setZone(tz)` and `end.startOf("day").minus({ days: q.days - 1 })`. |
| **Timezone wrong** | If `shop_config.timezone_iana` is not set (e.g. UTC or default), “today” is the wrong set of orders. | Set via `POST /internal/bootstrap` with `SHOP_TIMEZONE_IANA` (e.g. `America/Mexico_City`). |
| **Sync lag** | Orders or refunds from today not yet in DB. | `sync_state.last_sync_finished_at`; run `POST /internal/sync/run`. |
| **Aggregation / money** | Totals must be NUMERIC in DB and decimal strings in JS; no float math. | `src/services/incomeQueries.ts`: `SUM(...)::text`; `src/metrics/money.ts` and `src/metrics/computeIncomeComponents.ts` use Decimal. |

**Exact code pointers:**

- **Metric definition**: `src/metrics/computeIncomeComponents.ts` — `income_bruto` = lineItemsSubtotal + shippingAmount; `income_neto` = income_bruto − refunds. Exclusions: `shouldExcludeOrderV1` (cancelled, test, fully refunded).
- **Date window**: `src/api/routes/internal.ts` — summary-v2 and daily-v2: `const end = DateTime.now().setZone(tz); const start = end.startOf("day").minus({ days: q.days - 1 });` then `startUtc`/`endUtc` from `.toUTC().toJSDate()`.
- **Shopify query + mapping**: `src/shopify/graphql/ordersForIncomeV1.graphql` — `currentSubtotalPriceSet.shopMoney`, `currentShippingPriceSet.shopMoney`, `currentTotalTaxSet.shopMoney`, `currentTotalDiscountsSet.shopMoney`, `refunds.totalRefundedSet.shopMoney`. Mapping: `src/shopify/mappers/mapOrderToNormalized.ts`.
- **DB aggregation**: `src/services/incomeQueries.ts` — `listOrders` uses `between(orderIncomeV1.processedAt, startUtc, endUtc)` and `SUM(income_bruto)` etc. as NUMERIC; schema: `src/db/schema.ts` — `numeric("income_bruto", { precision: 20, scale: 6 })`.

**Minimal patch plan (applied):**

1. **Metric alignment**: First dashboard card labeled “Order Revenue” now shows **incomeNeto** (net after refunds) so it matches Shopify’s “Order Revenue”. No backend change; frontend uses `summary.incomeNeto.display` for that card.
2. **Default range**: Dashboard default is **Today** (`rangeDays: 1`) so the default view matches “today” in shop timezone.
3. **Reconciliation**: Use `GET /internal/income/summary-v2?days=1&debug=1` to get `window_utc.start` / `window_utc.end` (ISO) and compare with Shopify for the same window. Use `GET /internal/income/reconcile?from=YYYY-MM-DD&to=YYYY-MM-DD` for full-day totals; response now includes `range.window_utc`.
4. **Tests**: `src/services/__tests__/dateRange.test.ts` (Mexico TZ, same-day and multi-day); `src/api/__tests__/todayWindow.test.ts` (today = start of day to “now” in shop TZ). Decimal-safe aggregation is covered by existing `computeIncomeComponents` tests and NUMERIC schema.
