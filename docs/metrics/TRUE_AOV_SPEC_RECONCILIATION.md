# True AOV — Triple Whale vs This Codebase

This document reconciles **Triple Whale’s official documentation** (Revenue and True AOV, 2026) with **this repository’s** implementation. It states where they differ and what would be needed to achieve parity.

---

## 0. Triple Whale official documentation (summary)

### Revenue (Order Revenue)

- **Formula:**  
  Order Revenue = **Gross Sales – Discounts – Returns – Gift Card Redemptions + Shipping Revenue + Taxes**
- **Included:** Product sales, shipping revenue (if charged), taxes (if configured), **gift card sales** (at time of purchase, not redemption).
- **Excluded:** Gift card redemptions, refunds/returns (deducted when processed), discounts (deducted at sale), store credits, manual adjustments.
- **Gift cards:** Revenue when gift card is **purchased**; **not** counted when **redeemed** (to avoid double-counting).

### True AOV

- **Formula:**  
  **True AOV = (Order Revenue – Taxes – Shipping) / Number of Orders with Revenue > 0**
- **Numerator:** Order Revenue minus total shipping and total taxes (product revenue only).
- **Denominator:** Only orders where **net revenue is positive** ($0, test, and fully refunded orders excluded).
- **Included in numerator:** Product revenue (after discounts/returns), gift card sales (at purchase).
- **Excluded from numerator:** Shipping revenue, taxes, gift card redemptions.
- **Rounding:** Banker’s rounding (round half to even); calculations at lowest currency unit (e.g. centavos for MXN), then rounded at summary level.

### Example (from Triple Whale)

- 10 orders, 2 are $0/test/refunded → **8 valid orders**
- Total revenue (valid orders): 20,000 MXN  
- Total shipping: 1,000 MXN  
- Total taxes: 2,000 MXN  
- **True AOV = (20,000 – 1,000 – 2,000) / 8 = 17,000 / 8 = 2,125 MXN**

---

## 1. Where True AOV Is Computed (This Repo)

- **API:** `GET /internal/summary-v2` (see `src/api/routes/internal.ts`).
- **Dashboard tile:** `trueAov` → internal key `aovNeto` (see `apps/web/src/lib/metricsMeta.ts`).
- **Formula in this repo:**
  - **Numerator:** `incomeNeto` = sum of `order_income_v1.income_neto` for included orders in the selected date range.
  - **Denominator:** `ordersIncluded` = count of those same orders.
  - **AOV:**  
    `aovNeto = (ordersIncluded > 0) ? (incomeNeto / ordersIncluded) : 0`  
    Result is fixed to **6 decimal places**; when there are no orders, AOV is `"0.000000"`.

Relevant code:

```966:970:src/api/routes/internal.ts
            const ordersIncluded = s.ordersIncluded;
            const incomeNetoStr = s.incomeNeto;
            const aovNetoStr =
                ordersIncluded > 0
                    ? new Decimal(incomeNetoStr).div(ordersIncluded).toFixed(6)
                    : "0.000000";
```

Summary `s` comes from `listOrders()` in `src/services/incomeQueries.ts`: same date range and same inclusion rules (`excluded = false`). So **True AOV in this repo = (sum of income_neto for included orders in range) / (count of those orders)**.

---

## 2. Definition of “Income” (Numerator) in This Codebase

**Per order**, income is **income_neto**:

- **income_bruto** = lineItemsSubtotal + shippingAmount  
  - Tax is **never** added; it is reported but excluded from income.
- **income_neto** = income_bruto − refunds  

So in terms of “Total Sales − Taxes − Shipping”:

- **Total Sales** (for income) = subtotal (after discounts) + shipping. Tax is excluded by design, not subtracted after the fact.
- **Refunds** reduce income: income_neto = (subtotal + shipping) − refunds.

**Source of per-order fields (GraphQL, not REST):**

| Your spec / REST notion     | This repo (GraphQL → stored) |
|----------------------------|------------------------------|
| Subtotal (after discounts) | `currentSubtotalPriceSet.shopMoney` → `order_income_v1.line_items_subtotal` (and used to compute income_bruto) |
| Shipping                   | `currentShippingPriceSet.shopMoney` → `order_income_v1.shipping_amount` |
| Tax                        | `currentTotalTaxSet.shopMoney` → `order_income_v1.tax_amount` (reported only; not in income) |
| Discounts                  | `currentTotalDiscountsSet.shopMoney` → `order_income_v1.discount_amount` (breakdown only; subtotal is already net of discounts) |
| Refunds                    | Order `refunds[].totalRefundedSet.shopMoney` (with component fallbacks in mapper) → summed and stored in `order_income_v1.refunds`; income_neto = income_bruto − this sum |

Definitive logic:

- **Compute:** `src/metrics/computeIncomeComponents.ts`  
  - `income_bruto = lineItemsSubtotal + shippingAmount`  
  - `income_neto = income_bruto - refundsSum`
- **GraphQL:** `src/shopify/graphql/ordersForIncomeV1.graphql`
- **Mapping:** `src/shopify/mappers/mapOrderToNormalized.ts` (normalized order + refunds) → used by sync job which calls `computeIncomeComponents` and persists to `order_income_v1`.

---

## 3. Order Inclusion/Exclusion (Denominator and Numerator)

Only orders with **excluded = false** and **processed_at** in the selected range are included in both the sum of income_neto and the order count.

**Exclusion rules** (see `src/metrics/computeIncomeComponents.ts` → `shouldExcludeOrderV1`):

| Condition | Excluded? | Reason stored |
|-----------|-----------|----------------|
| Order has `cancelledAt` set | Yes | `cancelled` |
| Order is test (`test === true`) | Yes | `test` |
| Refunds ≥ income_bruto (fully refunded) | Yes | `fully_refunded` |
| Otherwise | No | — |

So:

- **Included:** Not cancelled, not test, not fully refunded, and processed_at in range.
- **Timestamp for “order in range”:** `processed_at` (order’s processed-at in Shopify). Date range is applied in UTC; bucketing by shop timezone is used for daily series elsewhere but the summary-v2 range is UTC-based for the filter.

---

## 4. Refunds

- **Per order:** Refunds are the sum of amounts from the order’s refunds (GraphQL: `refunds[].totalRefundedSet.shopMoney` with fallbacks in the mapper). That sum is stored in `order_income_v1.refunds` and subtracted from income_bruto to get income_neto.
- **No separate “refund date” for AOV:** The AOV numerator uses **per-order** income_neto (which already has refunds subtracted). There is no re-attribution of refunds by refund date for the summary-v2 AOV; refunds reduce the order’s income_neto on the order’s record.

---

## 5. Gift Cards

This codebase does **not** implement any special handling for gift cards (e.g. excluding gift card sales or treating them differently) for True AOV. If your spec or Triple Whale’s logic treats gift cards specially, that would be a **difference** until added here.

---

## 6. Rounding and Precision

- **Stored:** NUMERIC(20,6) for all money fields in `order_income_v1`.
- **AOV calculation:** `Decimal` division, then `.toFixed(6)`.
- **Display:** Typically 2 decimal places (half-up) in the UI; backend keeps 6 decimals for the metric.

---

## 7. Triple Whale official vs this repo

| Aspect | Triple Whale (official) | This repo (`aovNeto`) |
|--------|-------------------------|------------------------|
| **Formula** | (Order Revenue − Shipping − Taxes) / Orders with Revenue > 0 | (Sum of income_neto) / ordersIncluded |
| **Numerator** | **Product revenue only** (revenue minus shipping minus taxes) | **income_neto** = (subtotal + shipping) − refunds → **includes shipping** |
| **Taxes** | Subtracted from revenue for True AOV | Never in income; excluded by design ✓ |
| **Shipping** | **Excluded** from True AOV numerator | **Included** in numerator (part of income_neto) ❌ |
| **Refunds/returns** | Deducted from revenue | Same: income_neto = income_bruto − refunds ✓ |
| **Gift card redemptions** | Excluded from revenue | Not implemented (no special handling) ❌ |
| **Gift card sales** | Included in revenue (at purchase) | Not implemented (no special handling) ❌ |
| **Orders with revenue ≤ 0** | Excluded from **both** numerator and denominator | Only **fully refunded** excluded; orders with **negative** income_neto are **included** ❌ |
| **Test / $0 / cancelled** | Excluded | Same: excluded ✓ |
| **Rounding** | Banker’s rounding (round half to even) | `.toFixed(6)`; display often half-up ❌ |
| **Timestamp** | processed_at (or attribution model) | processed_at ✓ |

So:

- **(a)** This repo’s **aovNeto** is **not** the same as Triple Whale’s True AOV: we **include shipping** in the numerator and do not subtract it; we **include** orders with negative income_neto; we have **no** gift card logic; we use different rounding.
- **(b)** To align the **spec** with Triple Whale’s docs: use the official formula above; define numerator as (Order Revenue − Shipping − Taxes); denominator as orders with revenue > 0; document gift card and banker’s rounding rules.
- **(c)** To align **this codebase** with Triple Whale True AOV, see §9 below.

---

## 8. Reference Files

- `src/api/routes/internal.ts` — summary-v2, `aovNeto` from `s.incomeNeto` and `s.ordersIncluded`
- `src/services/incomeQueries.ts` — `listOrders()` builds `summary` (SUM(income_neto), count) with `whereIncluded`
- `src/metrics/computeIncomeComponents.ts` — income_bruto, income_neto, and `shouldExcludeOrderV1`
- `src/jobs/processors/syncOrdersIncomeV1.ts` — reads GraphQL, maps, computes components, sets `excluded`, writes `order_income_v1`
- `src/shopify/graphql/ordersForIncomeV1.graphql` — GraphQL field list
- `src/shopify/mappers/mapOrderToNormalized.ts` — GraphQL → normalized order + refunds
- `docs/metrics/income_v1_contract.md` — contract for income v1 (including inclusion rules and formulas)

---

## 9. Achieving parity with Triple Whale True AOV

**Implemented (as of this release):** Numerator = product revenue only (`incomeNetoProductOnly`), denominator = orders with revenue > 0 (`ordersWithPositiveRevenue`), banker's rounding for AOV (`roundToDecimalsHalfEven`). Gift cards are not yet implemented.

To make this repo’s True AOV match Triple Whale’s official formula, the following changes would be needed.

### 9.1 Numerator: exclude shipping (and keep tax excluded)

- **Current:** `aovNeto = SUM(income_neto) / ordersIncluded` with `income_neto = (subtotal + shipping) − refunds`.
- **Triple Whale:** Numerator = Order Revenue − Shipping − Taxes. Here “Order Revenue” (for the store) is effectively gross sales − discounts − returns (+ gift card sales, − gift card redemptions) + shipping + taxes; for True AOV they then subtract shipping and taxes, so numerator = **product revenue only**.
- **Change:** Use a **product-only** numerator. With current schema you can compute:
  - **Product revenue per order** = `income_neto − shipping_amount` = (subtotal + shipping − refunds) − shipping = subtotal − refunds (product only, assuming refunds apply to product).
  - So **True AOV numerator** = `SUM(income_neto − shipping_amount)` over included orders, or equivalently `SUM(income_neto) − SUM(shipping_amount)`.
- **Implementation:** In summary-v2 (and any aggregation), either:
  - Add a new summary field `incomeNetoProductOnly` = SUM(income_neto) − SUM(shipping_amount), and use it for True AOV; or
  - Add a stored column per order for “product revenue” (e.g. income_neto − shipping_amount) and sum that.  
  ListOrders/summary currently does not expose SUM(shipping_amount) in a way that’s reused for AOV; the summary has `shippingAmount` as the sum, so the backend can compute (incomeNeto − shippingAmount) for the numerator.

### 9.2 Denominator: exclude orders with revenue ≤ 0

- **Current:** All orders with `excluded = false` (not cancelled, not test, not fully refunded) count; orders with **negative** income_neto are still included.
- **Triple Whale:** Only “orders with revenue > 0” (and exclude $0, test, fully refunded).
- **Change:** Restrict denominator (and numerator) to orders where **income_neto > 0**. That may require:
  - Either filtering in SQL: `WHERE excluded = false AND income_neto > 0` (and same for the sum), or
  - Adding a flag or derived metric “has positive revenue” and using it in summary-v2.  
  Fully refunded orders are already excluded via `excluded = true`; the new rule is to also exclude any order whose income_neto ≤ 0 (e.g. partial refunds that exceed product+shipping in edge cases, or $0 orders that weren’t marked test).

### 9.3 Gift cards

- **Triple Whale:** Gift card **sales** count as revenue (at purchase); gift card **redemptions** do not (to avoid double-counting).
- **Change:** Identify gift card payments (e.g. Shopify `payment_gateway` or transaction types, or line item type) and either:
  - Exclude the redemption amount from revenue for orders paid (partially or fully) with gift cards, or
  - Exclude such orders from revenue/AOV depending on Triple Whale’s exact rule.  
  Requires GraphQL/API support for payment method or line types (e.g. `Order.sourceName`, transactions, or line item `__typename` / gift card product type). No gift card logic exists in the repo today.

### 9.4 Rounding

- **Triple Whale:** Banker’s rounding (round half to even); calculations at lowest currency unit, then rounded at summary level.
- **Current:** `Decimal` with `.toFixed(6)`; display often half-up.
- **Change:** Use banker’s rounding for the final True AOV value (and optionally for all currency display). In JavaScript/TS, implement “round half to even” for the AOV result instead of `toFixed()` (which is half-up).

### 9.5 Summary table (parity checklist)

| Requirement | Status in repo | Change needed |
|-------------|----------------|---------------|
| Numerator = product revenue only (no shipping, no tax) | ✓ Implemented | — Uses `incomeNetoProductOnly` (sum of income_neto − shipping_amount for orders with income_neto > 0). |
| Exclude orders with revenue ≤ 0 | ✓ Implemented | — Denominator is `ordersWithPositiveRevenue`; numerator uses same filter. |
| Exclude gift card redemptions from revenue | ❌ Not implemented | Add gift card detection and exclusion (needs Shopify data) |
| Include gift card sales | ❌ Not implemented | Same as above |
| Banker’s rounding | ❌ Half-up / toFixed(6) | Use round-half-to-even for final AOV (and optionally display) |
| Exclude test / cancelled / fully refunded | ✓ | None |
| processed_at for range | ✓ | None |

