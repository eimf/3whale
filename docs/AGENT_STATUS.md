# Agent Status — Final

**Last updated**: 2026-03-03 — ✅ COMPLETE

---

## Result: ALL 8 METRICS MATCH

| # | Metric | Our Value | Expected | Status |
|---|--------|-----------|----------|--------|
| 1 | Orders # | 169 | 169 | ✅ |
| 2 | Gross sales | 425,279.00 | 425,279.00 | ✅ |
| 3 | Discounts | -126,096.10 | -126,096.10 | ✅ |
| 4 | Returns | -9,304.30 | -9,304.30 | ✅ |
| 5 | Net sales | 289,878.60 | 289,878.60 | ✅ |
| 6 | Shipping | 13,547.00 | 13,547.00 | ✅ |
| 7 | Taxes | 0.00 | 0.00 | ✅ |
| 8 | Total sales | 303,425.60 | 303,425.60 | ✅ |

---

## Solution: ShopifyQL Analytics API

All 8 parity metrics are sourced from ShopifyQL (`FROM sales SHOW ...`), which uses
Shopify's own internal calculation engine — guaranteeing exact parity with Shopify Analytics.

**Why not GraphQL Admin API?**
The Admin API's order-level fields (`currentSubtotalPriceSet`, `currentTotalDiscountsSet`, etc.)
don't match Shopify Analytics due to:
- Returns: order edits, restock-only returns, internal adjustments not captured by `refundLineItems`
- Gross Sales: Shopify Analytics uses line-item original prices, not order-level subtotals
- Discounts/Shipping: minor gaps from how Shopify internally computes these

**Requirements:**
- `read_reports` scope on the Shopify app
- API version `>= 2025-10` (ShopifyQL field not available in 2025-04 or earlier)

---

## Code Changes

| File | Change |
|------|--------|
| `src/shopify/client/shopifyqlClient.ts` | ShopifyQL client fetching all 8 metrics |
| `src/services/incomeQueries.ts` | Parity function accepts ShopifyQL override for all metrics |
| `src/api/routes/internal.ts` | Route calls ShopifyQL before parity calculation |
| `src/api/routes/auth.ts` | OAuth scope updated to `read_orders,read_reports` |
| `src/services/__tests__/shopifyCanonicalParity.test.ts` | Tests for ShopifyQL override |
| `src/api/__tests__/summaryV2.parity.contract.test.ts` | Mock for ShopifyQL |
| `docs/metrics/shopify_canonical_semantics.md` | Architecture docs |
| `docs/DECISIONS.md` | Decision log |
