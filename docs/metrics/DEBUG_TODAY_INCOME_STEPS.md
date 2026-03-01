# Debug "Today" income step by step

When the dashboard "Order Revenue" (today) doesn’t match Shopify, follow these steps to see where it breaks.

---

## Step 1: Run the debug script

From repo root (with `.env` and `DATABASE_URL` set):

```bash
npm run debug:today
```

The script prints:

- **Step 1** — Shop config: `timezone_iana`, `currency_code`. If timezone is wrong, "today" is the wrong day.
- **Step 2** — Date window used for "today" (same as API when `days=1`): `window_utc.start` and `window_utc.end` in ISO. This is the exact range used to filter orders.
- **Step 3** — DB totals for that window (only `excluded = false`): order count, `SUM(income_bruto)`, `SUM(refunds)`, `SUM(income_neto)`. This is what the API returns.
- **Step 4** — Sync state: `last_sync_finished_at`, `watermark_processed_at`. If sync is old, today’s orders may be missing.
- **Step 5** — First 5 order IDs in the window (for spot-checking in Shopify).

**Compare:**

- Script’s **SUM(income_neto)** vs what the **API** returns for `GET /internal/income/summary-v2?days=1` (field `orderRevenue.display` / `incomeNeto.display`). They must match; if not, the API or BFF is wrong.
- Script’s **SUM(income_neto)** and **order count** vs **Shopify** "Order Revenue" and "Orders" for the same day in the **store’s timezone**. Use the script’s `window_utc.start` / `window_utc.end` to know which orders we’re including (Shopify uses `processed_at` / payment date).

---

## Step 2: If the script and API match but differ from Shopify

Then the problem is either:

**A) Wrong set of orders (date/timezone)**

- Confirm Shopify’s "Today" is the same calendar day in the **same timezone** as `shop_config.timezone_iana`.
- In Shopify, filter by **payment/processed** date, not order-created date.
- Our window for `days=1` is **[start of today in shop TZ, now]**. If Shopify shows "today" as the full day (00:00–23:59), use the reconcile endpoint with the same date for both `from` and `to`:  
  `GET /internal/income/reconcile?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  That uses full calendar day (start of day to end of day in shop TZ).

**B) Sync missing or stale**

- If **order count** in the script is 0 or much lower than Shopify, run sync:  
  `POST /internal/sync/run`  
  Then run `npm run debug:today` again and re-check.

**C) Metric definition**

- We use **income_neto** = subtotal (after discounts) + shipping − refunds, no tax. Shopify "Order Revenue" is net sales; it should align. If definitions differ (e.g. we exclude test/cancelled/fully refunded), counts and totals will differ.

---

## Step 3: If the script and API don’t match

Then the bug is in the API path (wrong window, wrong filter, or wrong aggregation). Check:

- Same **timezone** in config (script and API both read `shop_config`).
- Same **window**: API uses `DateTime.now().setZone(tz)` and `end.startOf("day")` for `days=1`; the script replicates that.
- Same **filter**: `processed_at BETWEEN startUtc AND endUtc` and `excluded = false`.

---

## Step 4: Get the exact window from the API (for reconciliation)

To see the window the API used for a request:

```bash
curl -s -H "x-internal-api-key: YOUR_KEY" \
  "http://localhost:3000/internal/income/summary-v2?days=1&debug=1"
```

Response includes `window_utc: { start, end }`. Use those timestamps in Shopify (or in the DB) to verify which orders are included.

---

## Checklist

| Check                                            | What to do                                           |
| ------------------------------------------------ | ---------------------------------------------------- |
| Script SUM(income_neto) = API orderRevenue?      | If no → API/BFF bug. If yes → go to next.            |
| Script order count = Shopify Orders (today)?     | If no → timezone, date type, or sync.                |
| Script SUM(income_neto) ≈ Shopify Order Revenue? | If no → definition (tax, exclusions) or sync/window. |
| last_sync_finished_at recent?                    | If no → run sync and re-run script.                  |
| timezone_iana correct for store?                 | If no → fix via bootstrap / config.                  |
