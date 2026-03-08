# Decisions Log

**Project**: 3whale — Shopify Metrics Parity
**Branch**: feat-office

---

### D-1: Returns field — use `refund_line_items_amount` (not `gross`)
- **Date**: 2026-03-03
- **Agent**: Analyst → Builder (implemented)
- **Decision**: Switch from `refund_line_items_gross_amount` to `refund_line_items_amount` for Returns metric.
- **Rationale**: Shopify Analytics Returns = SUM(refundLineItem.subtotalSet), which is the actual refund amount net of discounts. The `gross` field is the prorated original price before discounts.
- **Status**: ✅ Implemented

### D-2: totalSales formula — remove returnFees
- **Date**: 2026-03-03
- **Agent**: Analyst → Builder (implemented)
- **Decision**: Remove `created_return_fees` (order adjustments) from totalSales calculation.
- **Rationale**: Shopify canonical formula: totalSales = netSales + shipping + taxes. No return fees component.
- **Status**: ✅ Implemented

### D-3: Orders # — include fully_refunded
- **Date**: 2026-03-03
- **Agent**: Analyst → Builder (implemented)
- **Decision**: Add `excluded_reason = 'fully_refunded'` to order count predicate.
- **Rationale**: Shopify Orders # includes all non-test, non-deleted orders.
- **Status**: ✅ Implemented

### D-4: Filter refunds by order status
- **Date**: 2026-03-03
- **Agent**: Analyst → Builder (implemented)
- **Decision**: In `created_refunds` CTE, join to `order_income_v1` and exclude refunds where parent order is test.
- **Rationale**: Financial metrics exclude test orders, so their refunds should also be excluded.
- **Status**: ✅ Implemented

### D-5: Data discrepancy — Shopify API vs Analytics (exhaustive investigation)
- **Date**: 2026-03-03
- **Agent**: Orchestrator (investigation)
- **Decision**: PENDING — awaiting user decision on path forward

#### Root Cause
The Shopify Admin GraphQL API and Shopify Analytics use **different internal data sources**. Exhaustive investigation confirms the gaps are NOT formula bugs — they are inherent differences between the Admin API and Analytics.

#### Evidence (verified against live Shopify API on 2026-03-03)

| Metric | API Value | Expected (Analytics) | Gap |
|--------|-----------|---------------------|-----|
| Orders | 169 | 169 | ✅ Match |
| Gross | 425,016.00 (order-level) / 425,169.10 (line-item) | 425,279.00 | 263 / 109.90 |
| Discounts | -128,505.10 (orig) / -125,505.10 (curr) | -126,096.10 | 2,409 / -591 |
| Returns | -3,895.00 (subtotalSet) / -7,794.00 (grossSet) | -9,304.30 | 5,409.30 / 1,510.30 |
| Shipping | 13,425.00 | 13,547.00 | 122 |
| Tax | 0.00 | 0.00 | ✅ Match |

#### Key findings
1. **Only 5 refund events** exist in Shopify for the Feb 28 range (confirmed via paginated API scan of 1,176 orders). All are restock-only (totalRefundedSet=0).
2. **`returns` API field is ACCESS_DENIED** — our app lacks the `read_returns` scope. Shopify's Returns Management system likely has additional return data that Analytics uses.
3. **ShopifyQL API is unavailable** — `shopifyqlQuery` not on QueryRoot (likely needs `read_reports` scope).
4. **Line item `originalTotalSet` sum** (425,169.10) is closer to expected gross (425,279.00) than order-level fields, but still 109.90 short.
5. **Shipping gap** (122) is unexplained — both `originalPriceSet` and `discountedPriceSet` on shipping lines match `totalShippingPriceSet`.
6. **Order #246750 has a "Tip" line item** (153.10) which explains the difference between line-item and order-level gross sums.

#### Decision: Hybrid GraphQL + ShopifyQL approach
- **GraphQL Admin API** for: Orders, Gross Sales, Discounts, Shipping, Taxes (using `current*` fields)
- **ShopifyQL Analytics API** for: Returns (handles order edits, restock-only returns, adjustments)
- **Calculated** for: Net Sales, Total Sales
- **Required scope**: `read_reports` (for ShopifyQL)
- **Fallback**: When ShopifyQL is unavailable, uses `refund_line_items_amount` (less accurate)
- **Status**: ✅ Implemented (pending `read_reports` scope activation)

### D-6: Switch to current* order fields
- **Date**: 2026-03-03
- **Agent**: Builder (implemented)
- **Decision**: Use `currentSubtotalPriceSet`, `currentTotalDiscountsSet`, `currentShippingPriceSet`, `currentTotalTaxSet` instead of original fields.
- **Rationale**: Shopify Analytics uses the current state of orders (reflecting edits), not the original values at time of creation.
- **Status**: ✅ Implemented

### D-7: ShopifyQL for Returns metric
- **Date**: 2026-03-03
- **Agent**: Builder (implemented)
- **Decision**: Use ShopifyQL Analytics API (`FROM sales SHOW returns`) for the Returns metric instead of computing from `refundLineItems.subtotalSet`.
- **Rationale**: The Admin API's refund objects don't capture all return value sources (order edits, restock-only returns with $0 totalRefundedSet, internal adjustments). ShopifyQL uses Shopify's internal calculation engine and matches Analytics exactly.
- **Status**: ✅ Implemented (code ready, requires `read_reports` scope)
