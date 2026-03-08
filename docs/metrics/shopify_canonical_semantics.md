# Shopify canonical semantics (parity contract)

This document pins the canonical Shopify parity behavior used by `summary-v2`.

## Architecture: ShopifyQL as source of truth

All 8 canonical parity metrics come from the **ShopifyQL Analytics API** (`FROM sales`).
This guarantees exact parity with Shopify Analytics by using the same calculation engine.

| Metric | Source | ShopifyQL Column |
|--------|--------|------------------|
| Orders # | ShopifyQL | `orders` |
| Gross Sales | ShopifyQL | `gross_sales` |
| Discounts | ShopifyQL | `discounts` |
| Returns | ShopifyQL | `returns` |
| Net Sales | ShopifyQL | `net_sales` |
| Shipping | ShopifyQL | `shipping_charges` |
| Taxes | ShopifyQL | `taxes` |
| Total Sales | ShopifyQL | `total_sales` |

**Requirements:**
- API version `>= 2025-10` (field `shopifyqlQuery` not available in earlier versions)
- Access scope: `read_reports`
- When ShopifyQL is unavailable, falls back to DB-computed values from synced GraphQL data

**Fallback (DB-computed):**
When the `read_reports` scope is missing or the API version is too old, the system
falls back to computing metrics from `shopify_order_raw` (using `current*` fields)
and `order_refund_event_v1`. This fallback is less accurate for Returns (misses
order edits, restock-only returns, internal adjustments) and has minor gaps in
Gross Sales, Discounts, and Shipping due to Shopify Analytics using internal
line-item calculations not fully exposed by the Admin API.

## ShopifyQL query

```
FROM sales
SHOW orders, gross_sales, discounts, returns, net_sales, shipping_charges, taxes, total_sales
SINCE {fromDate}
UNTIL {toDate}
```

## Fallback formulas (DB-computed, less accurate)

- `grossSales = currentSubtotal_total + currentDiscounts_total`
- `discounts = -currentDiscounts_total`
- `returns = -SUM(refund_line_items_amount)` from `order_refund_event_v1`
- `netSales = grossSales + discounts + returns`
- `shippingCharges = currentShipping_total - refunds_shipping`
- `taxes = currentTax_total - refund tax components`
- `totalSales = netSales + shippingCharges + taxes`

## Sign conventions

- `discounts` and `returns` are reported as negative values.
- `shippingCharges` and `taxes` can be negative when refund components exceed order-period base components.

## Inclusion/exclusion

Parity follows the endpoint filter:

- `includeExcluded=false` => order count: only orders with `excluded = false` OR `excluded_reason = 'cancelled'` OR `excluded_reason = 'fully_refunded'`. **Financials**: from orders where `cancelledAt`/`canceledAt` is null and `test` is false only (do not filter by `excluded`; matches Shopify Analytics "active orders").
- `includeExcluded=true` => order count: all orders in range; financials/refunds include all.
- Note: ShopifyQL does not support `includeExcluded` filtering. When ShopifyQL is active, the parity values reflect Shopify Analytics' own inclusion logic.

## Model invariants

- `shopifyParityModel` is always `total_base_created_returns`.
- No runtime model selection is supported.
- No candidate-model payload is exposed.
