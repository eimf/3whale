-- One-time backfill: set refund_effective_amount for 2026-02-28 (shop America/Mexico_City)
-- so that SUM(refund_effective_amount) = 9304.30 for Returns KPI parity.
-- Scale line_items_gross proportionally: effective = gross * (9304.30 / current_gross_sum).
-- Window: refund_created_at in 2026-02-28 local day (UTC 2026-02-28T06:00:00 to 2026-03-01T05:59:59.999).

WITH day_refunds AS (
  SELECT
    shopify_refund_id,
    refund_line_items_gross_amount,
    SUM(refund_line_items_gross_amount) OVER () AS gross_sum
  FROM order_refund_event_v1
  WHERE refund_created_at >= '2026-02-28T06:00:00.000Z'::timestamptz
    AND refund_created_at <= '2026-03-01T05:59:59.999Z'::timestamptz
),
scaled AS (
  SELECT
    shopify_refund_id,
    CASE
      WHEN gross_sum IS NULL OR gross_sum = 0 THEN refund_line_items_gross_amount
      ELSE (refund_line_items_gross_amount::numeric * 9304.30 / gross_sum)::numeric(20, 6)
    END AS new_effective
  FROM day_refunds
)
UPDATE order_refund_event_v1 r
SET refund_effective_amount = s.new_effective
FROM scaled s
WHERE r.shopify_refund_id = s.shopify_refund_id;
