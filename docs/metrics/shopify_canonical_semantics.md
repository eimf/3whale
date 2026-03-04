# Shopify canonical semantics (parity contract)

This document pins the canonical Shopify parity behavior used by `summary-v2`.

## Scope and attribution

- **Order timestamp**: Use **order processed date** (`Order.processedAt`) in store timezone for order-side attribution (not `createdAt`).
- Order-side metrics (order count, `gross sales`, `discounts`, base `shipping`, base `taxes`) are attributed to **processed date** in store timezone.
- Return-side metrics are attributed to **refund created date** (`Refund.createdAt`) in store timezone.
- Store timezone comes from `shop_config.timezone_iana`.
- Window conversion is local-date range (`from`/`to`) converted to UTC via `parseLocalDateRangeToUtc`.

## Order count vs financial metrics

- **Orders #** (order count): Count all orders with `processedAt` in range. **Include cancelled** orders. Exclude only **test** and **deleted** (when applicable). Exposed as `ordersCountParity` in summary-v2.
- **Financial metrics** (gross sales, discounts, shipping, taxes): **Exclude cancelled** orders (`order.cancelledAt` IS NULL). Exclude test and deleted. Exclude tips from all metrics. Gift card purchases included in gross sales; gift card redemptions included in discounts.
- **Returns**: Product-only (line-item gross amounts). Refunded shipping/taxes are not part of returns; they reduce Shipping charges and Taxes. Attribution by `refund.createdAt`.

## Canonical formulas

All values below are canonical for `shopifyParity` in `GET /internal/income/summary-v2`:

- `grossSales = subtotal_total + discounts_total` (from non-cancelled, non-test orders)
- `discounts = -discounts_total`
- `returns = -SUM(refund_line_items_gross_amount)` for refunds with `refund_created_at` in range (product-only; matches Shopify Analytics refundLineItems).
- `netSales = grossSales + discounts + returns`
- `shippingCharges = shipping_total - refunds_shipping_created`  
  Refund shipping: use `RefundShippingLine.amountSet` when present (Shopify Analytics parity), else `subtotalAmountSet`; stored in `order_refund_event_v1.refund_shipping_amount`.
- `taxes = tax_total - refunds_line_items_tax - refunds_shipping_tax - refunds_duties - refunds_order_adjustments_tax`
- `returnFees = max(refunds_order_adjustments_amount, 0)`
- `totalSales = netSales + shippingCharges + taxes + returnFees`

## Sign conventions

- `discounts` and `returns` are reported as negative values.
- `shippingCharges` and `taxes` can be negative when refund components exceed order-period base components.
- `grossSales`, `netSales`, and `totalSales` may be positive or negative depending on data.

## Inclusion/exclusion

Parity follows the endpoint filter:

- `includeExcluded=false` => order count: only orders with `excluded = false` OR `excluded_reason = 'cancelled'`. **Financials**: from orders where `cancelledAt`/`canceledAt` is null and `test` is false only (do not filter by `excluded`; matches Shopify Analytics “active orders”).
- `includeExcluded=true` => order count: all orders in range; financials/refunds include all.

## Model invariants

- `shopifyParityModel` is always `total_base_created_returns`.
- No runtime model selection is supported.
- No candidate-model payload is exposed.
