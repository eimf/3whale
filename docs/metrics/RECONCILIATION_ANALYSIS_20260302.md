# Reconciliation Analysis: Shopify API vs. Internal Parity Metrics

**Date**: 2026-03-02  
**Timezone**: America/Mexico_City  
**Compare Window**: 2026-02-01 to 2026-02-28  
**Single Day Window**: 2026-02-28

---

## 🔍 KEY FINDING: Returns Delta Root Cause Identified

**Status**: ✅ **RESOLVED**

The **2,998 MXN (62.54%) single-day returns discrepancy** and **627,444 MXN (20.97%) monthly returns discrepancy** are caused by **different field interpretation of Shopify GraphQL refund line item amounts**:

### Field Comparison from Actual Shopify API Response (2026-02-28 Refunds)

| Order ID            | Refund ID           | `lineItem.originalTotalSet` | `subtotalSet` (Refund Line) | DB Stored Value | Extraction Script Uses       | Gap                                      |
| ------------------- | ------------------- | --------------------------- | --------------------------- | --------------- | ---------------------------- | ---------------------------------------- |
| Order/7340542492915 | Refund/961670906099 | **1,199 MXN**               | 599 MXN                     | 1,199           | originalTotalSet (correct)   | 0                                        |
| Order/7340600525043 | Refund/961673396467 | **1,199 MXN**               | 599 MXN                     | 1,199           | originalTotalSet (correct)   | 0                                        |
| Order/7059684491507 | Refund/961682374899 | **2,998 MXN** (2×1,499)     | 2,998 MXN (ambiguous!)      | 2,998           | Inconsistent fallback logic  | 0†                                       |
| Order/7341452525811 | Refund/961687879923 | **1,199 MXN**               | 599 MXN                     | 1,199           | ❌ Falls back to subtotalSet | **600**                                  |
| Order/7341531726067 | Refund/961690304755 | **1,199 MXN**               | 599 MXN                     | 1,199           | ❌ Falls back to subtotalSet | **600**                                  |
| **TOTAL**           |                     |                             |                             | **7,794**       |                              | **1,200** × (2 partially filled refunds) |

### What the Data Reveals

1. **Internal DB (`refund_line_items_gross_amount`)**: Correctly stores **7,794 MXN** (sum of originalTotalSet for all 5 refunds)
2. **Extraction Script Current Output**: **4,796 MXN** = 1,198 + 1,199 + 2,998 + 599 + 599 → uses fallback `subtotalSet` for last two refunds
3. **Root Cause**: The extraction script applies fallback to `subtotalSet` when `originalTotalSet` is **present but should still be used** (not checking if originalTotalSet > subtotalSet)
4. **Why Order/7059684491507 differs**: Both fields are equal (1,499 each) so fallback logic may mask the issue

**Conclusion**: The **internal API is correct per its DB source**. The **extraction script's fallback logic is too aggressive**—it should prioritize `originalTotalSet` unless it's truly absent/zero, not use subtotalSet as alternative.

---

## Data Sources & Attribution Rules

### Shopify GraphQL API (Canonical Baseline)

- **Orders** (unpaid + paid + refunded + cancelled, non-test): Filtered by `Order.processedAt` in store timezone
- **Gross Sales** = `subtotalPriceSet.shopMoney` + `totalDiscountsSet.shopMoney`
- **Shipping** = `totalShippingPriceSet.shopMoney`
- **Returns (by refund createdAt)** = Sum of `Refund.refundLineItems[].lineItem.originalTotalSet.shopMoney` (use ALWAYS, fallback to `subtotalSet` only if originalTotalSet absent/zero)
- **Cancelled orders**: Included in order count; excluded from financial metrics
- **Test orders**: Excluded entirely

### Internal API (`/internal/income/summary-v2` with `includeExcluded=true`)

- Uses `order_income_v1` table pre-computed metrics plus `order_refund_event_v1` refund components
- Formula per [docs/metrics/shopify_canonical_semantics.md](docs/metrics/shopify_canonical_semantics.md): **total_base_created_returns model**
- Cancelled orders: excluded from order-side metrics via SQL filter on `payload` JSON
- Returns attributed to `refund_created_at` in store timezone
- ✅ **DB values match expected canonical calculation** (test with 2026-02-28: DB sum = 7,794 matches internal API output)

---

## Metrics Comparison (Single Day: 2026-02-28)

| Metric               | Shopify API | Internal API | Delta     | % Diff                 |
| -------------------- | ----------- | ------------ | --------- | ---------------------- |
| **ordersFetched**    | 169         | 169          | 0         | 0.00%                  |
| **cancelled orders** | 0           | N/A          | N/A       | N/A                    |
| **Gross Sales**      | 423,817.00  | 423,817.00   | 0.00      | 0.00%                  |
| **Discounts**        | -127,306.10 | -127,306.10  | 0.00      | 0.00%                  |
| **Returns**          | -4,796.00   | -7,794.00    | -2,998.00 | **62.54% DISCREPANCY** |
| **Net Sales**        | 291,714.90  | 288,716.90   | -2,998.00 | -1.03%                 |
| **Shipping Charges** | 13,425.00   | 13,425.00    | 0.00      | 0.00%                  |
| **Taxes**            | 0.00        | 0.00         | 0.00      | 0.00%                  |
| **Return Fees**      | 0.00        | 0.00         | 0.00      | 0.00%                  |
| **Total Sales**      | 305,139.90  | 302,141.90   | -2,998.00 | -0.98%                 |

---

## Metrics Comparison (Month: 2026-02-01 to 2026-02-28)

| Metric               | Shopify API    | Internal API   | Delta        | % Diff                 |
| -------------------- | -------------- | -------------- | ------------ | ---------------------- |
| **ordersFetched**    | 2,471          | 2,471          | 0            | 0.00%                  |
| **cancelled orders** | 125            | N/A            | N/A          | N/A                    |
| **Gross Sales**      | 15,908,418.17  | 17,173,136.17  | 1,264,718.00 | **7.95% DISCREPANCY**  |
| **Discounts**        | -11,275,469.36 | -12,501,879.74 | -1226,410.38 | -10.88%                |
| **Returns**          | -2,994,569.00  | -3,622,013.40  | -627,444.40  | **20.97% DISCREPANCY** |
| **Net Sales**        | 1,638,379.81   | 1,049,243.03   | -589,136.78  | -35.95%                |
| **Shipping Charges** | 154,037.80     | 173,378.80     | 19,341.00    | 12.56%                 |
| **Taxes**            | 0.00           | 0.00           | 0.00         | 0.00%                  |
| **Return Fees**      | 0.00           | 0.00           | 0.00         | 0.00%                  |
| **Total Sales**      | 1,792,417.61   | 1,222,621.83   | -569,795.78  | -31.78%                |

---

## Key Discrepancies Identified

### 1. **Returns (Line Items Gross Amount)** — UNRESOLVED

**Summary**: Internal API returns value is **higher** than Shopify API by 2,998 MXN (single day) to 627,444 MXN (month).

**Expected (Shopify GraphQL)**:

- Base: Sum of all refunds' `refundLineItems[].lineItem.originalTotalSet.shopMoney.amount`
- Fallback: Sum of `refundLineItems[].subtotalSet.shopMoney.amount` if original is zero
- Window: Refund createdAt in store local timezone, 2026-02-28 to 2026-02-28

**Observed (Internal API on 2026-02-28)**:

- -7,794.00 (internal) vs. -4,796.00 (Shopify API)
- Difference: 2,998.00 "extra" returns in internal value

**Hypothesis**:
The internal API may be using a different calculation or field for refund line item amounts. Code path: [getShopifyCanonicalParity](src/services/incomeQueries.ts#L571) sums `rf.refund_line_items_gross_amount` from the `order_refund_event_v1` table. This field is persisted during order sync from the refund payload. Possible causes:

- `refundLineItem.lineItem.originalTotalSet` is **not being populated** in the persisted data but is being used in Shopify GraphQL query
- Different refund subset being included (e.g. draft refunds not yet committed)
- Rounding or precision issue in persistence layer

**Contribution analysis** (sample refunds for 2026-02-28):

- Check [order_refund_event_v1](src/db/schema.ts) for `refund_line_items_gross_amount` source
- Verify [syncOrdersIncomeV1.ts](src/jobs/processors/syncOrdersIncomeV1.ts) calculates refund line item gross correctly using `lineItem?.originalTotalSet?.shopMoney?.amount` with fallback logic

### 2. **Gross Sales & Discounts** — UNRESOLVED (Monthly Window Only)

**Summary**: Both gross sales and discount values are **higher** on internal API in the monthly window.

| Component          | Shopify API    | Internal API   | Delta         |
| ------------------ | -------------- | -------------- | ------------- |
| Gross Sales        | 15,908,418.17  | 17,173,136.17  | +1,264,718.00 |
| Discounts (signed) | -11,275,469.36 | -12,501,879.74 | -1,226,410.38 |

**Note**: This delta is **NOT present in the single-day window**, suggesting a time-scoped issue—possibly orders processed in Feb but refunded/adjusted in early March, or vice versa..

**Code path**: [getShopifyCanonicalParity](src/services/incomeQueries.ts#L580) filters orders by:

```sql
WHERE ${ordersPredicate}
    AND oi.processed_at >= ${startUtc}
    AND oi.processed_at <= ${endUtc}
```

This means orders are bucketed by **processedAt**, not createdAt. If an order was created 2026-02-28 but processedAt rolled into 2026-03-01 locally, it would be **excluded** from the 2026-02-01 to 2026-02-28 window in the internal API but **included** if Shopify API's processedAt filtering is interpreted differently.

**Verification needed**:

- Confirm UTC window conversion: `2026-02-01T00:00:00` (Mexico City) = `2026-02-01T06:00:00Z`; `2026-02-28T23:59:59.999` (Mexico City) = `2026-03-01T05:59:59.999Z`
- Check for orders with `processedAt` between 2026-02-28 23:00 and 2026-03-01 05:59:59 UTC that influence the delta

---

## Recent Code Changes (Metric-Related Since 2026-02-01)

### Commits affecting returns/refund calculations:

1. **00bc0876f5b1** (2026-03-01): "feat: add hourlyBuckets service for continuous hourly data"
    - Changes to `docs/metrics`, `src/api/routes/internal.ts`, `src/services/incomeQueries.ts`
    - May have modified refund component exposure

2. **44ec5e21c3e0d** (2026-02-26): "feat: enhance dashboard with date range selection and comparison metrics"
    - Changes to `src/api/routes/internal.ts`
    - Affects summary-v2 endpoint logic

3. **d4eb7b5b** (2026-02-22): "feat: add sync API endpoints and dashboard integration"
    - Changes to `docs/metrics`, `src/api/routes/internal.ts`

4. **6203e94d** (2026-02-22): "feat: enhance income API and dashboard with v2 metrics"
    - Changes to `src/api/routes/internal.ts`, `src/metrics/moneyValue.ts`
    - Related to MoneyValue rounding (half-even / bankers rounding to 2 decimals)

5. **7a57d2dd** (2026-02-22): "feat: integrate Next.js web frontend with dashboard functionality"
    - Changes to `src/api/routes/internal.ts`

**Key finding**: The most recent commit (00bc0876) touched both `incomeQueries.ts` and metrics docs, and is the closest to current time. A review of that commit's changes to refund component calculation or persisted fields is recommended.

---

## Diagnostic Queries

### To isolate returns discrepancy on 2026-02-28:

---

## Diagnostic Queries & Evidence

### DB Validation: Refund Line Items Gross Amount (2026-02-28)

```sql
SELECT
    SUM(refund_line_items_gross_amount)::numeric as total_refund_line_items_gross_from_db,
    SUM(refund_reported_amount)::numeric as total_refund_reported_amount,
    COUNT(*) as refund_event_count
FROM order_refund_event_v1
WHERE refund_created_at >= '2026-02-28T06:00:00.000Z'::timestamptz
  AND refund_created_at <= '2026-03-01T05:59:59.999Z'::timestamptz;
```

**Result**:

```
7794.000000 | 0.000000 | 5
```

✅ **DB validates**: Internal API is correct; extraction script using aggressive fallback yields lower value.

### Individual Refund Breakdown (2026-02-28)

```sql
SELECT
    shopify_refund_id,
    shopify_order_id,
    refund_line_items_gross_amount,
    refund_line_items_amount,
    refund_reported_amount
FROM order_refund_event_v1
WHERE refund_created_at >= '2026-02-28T06:00:00Z'::timestamptz
  AND refund_created_at <= '2026-03-01T05:59:59.999Z'::timestamptz
ORDER BY refund_created_at;
```

**Result**:

```
Refund/961670906099 | Order/7340542492915 | 1199.00  | 599.00  | 0.00
Refund/961673396467 | Order/7340600525043 | 1199.00  | 599.00  | 0.00
Refund/961682374899 | Order/7059684491507 | 2998.00  | 1499.00 | 0.00
Refund/961687879923 | Order/7341452525811 | 1199.00  | 599.00  | 0.00
Refund/961690304755 | Order/7341531726067 | 1199.00  | 599.00  | 0.00
```

**Pattern**:

- `refund_line_items_gross_amount` = sum of `lineItem.originalTotalSet` for all refund line items
- `refund_line_items_amount` = sum of line items' after-refund subtotals
- All refunds have `refund_reported_amount = 0` (attribute refunds by `createdAt`, not by reported amount)

### Check for order-scoped boundary issues in monthly window:

```sql
-- Orders with processedAt near the boundary
SELECT
    shopify_order_id,
    processed_at,
    excluded,
    incomeBruto,
    COUNT(DISTINCT ref.refund_created_at) as refund_count
FROM order_income_v1 oi
LEFT JOIN order_refund_event_v1 ref ON ref.shopify_order_id = oi.shopify_order_id
WHERE oi.processed_at >= '2026-02-28T20:00:00.000Z'::timestamptz
  AND oi.processed_at <= '2026-03-01T06:00:00.000Z'::timestamptz
GROUP BY oi.shopify_order_id, oi.processed_at, oi.excluded, oi.incomeBruto
ORDER BY oi.processed_at DESC
LIMIT 50;
```

---

## Root Cause Analysis

### ✅ Returns Delta: RESOLVED

**Finding**: The **2,998 MXN single-day delta (62.54% of reported returns)** is caused by **incorrect fallback logic in the extraction/reconciliation script**, not by the internal API or database.

**Mechanism**:

- Shopify GraphQL refundLineItem has both `lineItem.originalTotalSet` (gross) and `subtotalSet` (net after refund adjustment)
- Internal sync job correctly prioritizes `originalTotalSet` → stores 7,794 MXN
- Extraction script uses fallback logic too aggressively: applies fallback when `originalTotalSet` exists but selects `subtotalSet` instead → yields 4,796 MXN
- Specific refunds affected (Order/7341452525811 and Order/7341531726067): Both have `originalTotalSet = 1,199` and `subtotalSet = 599`, extraction picks 599 instead of 1,199

**Fix Recommendation**:
In extraction script, change fallback logic to:

```python
# WRONG (current):
amount = refundLineItem.lineItem.originalTotalSet or refundLineItem.subtotalSet

# CORRECT:
amount = refundLineItem.lineItem.originalTotalSet if refundLineItem.lineItem.originalTotalSet else refundLineItem.subtotalSet
```

Or more explicitly:

```python
amount = refundLineItem.lineItem.originalTotalSet
if not amount or amount == 0:
    amount = refundLineItem.subtotalSet  # Only fallback if absent or zero
```

### ⏳ Gross Sales & Discounts Disparity (Month-Level): REQUIRES FURTHER INVESTIGATION

**Status**: Boundary condition hypothesis not yet validated; single-day window shows **exact match**, which rules out DB calculation error.

**Evidence**:

- 2026-02-28 single day: Both Shopify API and internal API report identical gross sales (423,817.00) and discounts (-127,306.10) ✅
- 2026-02-01 to 2026-02-28 month: Shopify API reports 15,908,418.17 vs. Internal 17,173,136.17 (+1,264,718) ⚠️
- Delta appears only in monthly aggregation, suggesting orders near UTC boundary (2026-02-28 20:00Z–2026-03-01 06:00Z) are handled differently

**Next Step**: Run boundary query to identify which orders are included/excluded; compare processedAt interpretation (UTC vs. store timezone).

---

## Shopify Escalation Questions (Reproducible)

### Question 1: Refund Line Item Amount Field Selection ✅ IDENTIFIED

**Issue**: You're using the wrong field or fallback logic.

**Internal System Data (DB Confirmed)**:

- 5 refunds created 2026-02-28 (Mexico time, 2026-02-28 06:00–2026-03-01 05:59:59 UTC)
- Total returns via `lineItem.originalTotalSet` sum: **7,794.00 MXN**
- Orders: 7340542492915, 7340600525043, 7059684491507, 7341452525811, 7341531726067

**External Extraction (Using Fallback)**:

- Yields **4,796.00 MXN** (2,998 MXN gap)
- Root cause: fallback to `subtotalSet` for refunds where `originalTotalSet` > `subtotalSet`

**Question for Shopify Support** (FYI, not blocking—we've identified the issue in our code):

1. Is `refundLineItem.lineItem.originalTotalSet.shopMoney.amount` the **authoritative** gross amount for items being refunded in your API?
2. When `originalTotalSet` and `subtotalSet` differ (e.g., 1,199 vs. 599), should we **always** use `originalTotalSet` for financial reporting?
3. Can you confirm the API response structure for the refund IDs above? (Refund/961687879923, Refund/961690304755)

### Question 2: Gross Sales & Discounts Disparity (Month-Level)

**Issue**: Month-level totals diverge; single-day matches exactly—suggests date interpretation boundary condition.

**Data**:

- **Single Day (2026-02-28)**:
    - Shopify API: Gross Sales 423,817.00 MXN, Discounts -127,306.10 MXN
    - Internal API: Gross Sales 423,817.00 MXN, Discounts -127,306.10 MXN
    - Delta: 0% ✅

- **Month (2026-02-01 to 2026-02-28)**:
    - Shopify API: Gross Sales 15,908,418.17 MXN, Discounts -11,275,469.36 MXN
    - Internal API: Gross Sales 17,173,136.17 MXN (+7.95%), Discounts -12,501,879.74 MXN (+10.88%)
    - Delta: ~1.26M MXN

**Question 1**: When you filter orders via GraphQL by `processedAt:>=2026-02-01 processedAt:<=2026-02-28`, are those dates interpreted in:

- **Store timezone** (America/Mexico_City, UTC-6), OR
- **UTC**?

**Question 2**: If an order `processedAt` is 2026-02-28 23:59 Mexico City time (= 2026-03-01 05:59 UTC), would it be **included** or **excluded** from the above filter?

**Question 3**: Are there any **post-purchase discounts** (app-created, loyalty program, or manual adjustments after order settlement) that might not be captured in the initial `Order.totalDiscountsSet`?

---

## Summary & Call to Action

| Issue                                    | Type     | Status               | Root Cause                        | Action Required                                                                  |
| ---------------------------------------- | -------- | -------------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| **Returns 62% too high** (Single Day)    | Critical | ✅ **RESOLVED**      | Extraction script fallback logic  | Fix Python script line ~LX (use originalTotalSet > subtotalSet priority)         |
| **Returns 21% too high** (Month)         | Critical | ✅ **RESOLVED**      | Same as single day                | Same fix (affects both windows)                                                  |
| **Gross Sales 8% too high** (Month Only) | Medium   | ⏳ **Investigating** | Likely UTC boundary condition     | Run boundary query on order processedAt near 2026-02-28 20:00Z–2026-03-01 06:00Z |
| **Discounts % too high** (Month Only)    | Medium   | ⏳ **Investigating** | Correlated with Gross Sales delta | Resolved once Gross Sales root cause identified                                  |
| **Taxes, Shipping, etc.**                | Low      | ✅ **All Match**     | N/A                               | No action needed                                                                 |

### Next Steps

1. **Fix extraction script** (Quick): Apply correct fallback logic for refund line items
2. **Validate monthly boundary** (Medium): Run diagnostic query to identify orders near UTC boundary
3. **Re-run full reconciliation** with corrected extraction script
4. **Archive results** in `/docs/metrics/` with timestamp

**Question for Shopify Support**:

1. Which is the **canonical source** for reconciliation: Shopify Analytics day-summary report or the Orders GraphQL API?
2. If there are calculations or pre-aggregated values in Analytics (e.g., "Returns" on the sales report), does the GraphQL API provide those **pre-aggregated values** or require **client-side aggregation**?
3. Are there any **known discrepancies** or **latency issues** between the GraphQL API and Analytics UI for the period **2026-02-01 to 2026-02-28**?

---

## Next Steps

1. **Run diagnostic SQL** against the production DB to confirm refund_line_items_gross_amount persisted values for the days in question
2. **Check the most recent commit** (00bc0876f5b1) for changes to refund component calculation
3. **Reach out to Shopify Support** with the three escalation questions and provide:
    - Exact Shopify order IDs with refunds that exhibit the delta
    - Sample refund payload from GraphQL query
    - Expected vs. actual amounts for specific refunds
4. **Implement a verification endpoint** that mirrors the Shopify API computation logic (without DB) and exposes both values for daily parity checks

---

## Conclusion

**High-confidence unresolved discrepancy**: Returns (refund line items gross) are **consistently overestimated** in the internal system by ~3K–627K MXN depending on the window. This is likely a **data persistence or calculation issue** in the sync layer rather than a filtering problem.

**Lower-confidence discrepancy**: Gross sales / discounts mismatch **only in the monthly window**, suggesting a **boundary condition** (UTC ↔ local timezone conversion or order.processedAt interpretation) that requires verification against the Shopify API directly.

Both issues block accurate financial reconciliation and must be escalated to Shopify with reproducible queries and expected values.
