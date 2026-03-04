#!/bin/bash
set -a
source .env
set +a

echo "=== Refund breakdown for 2026-02-28 ==="
psql "$DATABASE_URL" <<'SQL'
SELECT
    shopify_refund_id,
    shopify_order_id,
    refund_created_at,
    refund_line_items_gross_amount,
    refund_reported_amount,
    refund_line_items_amount
FROM order_refund_event_v1
WHERE refund_created_at >= '2026-02-28T06:00:00.000Z'::timestamptz
  AND refund_created_at <= '2026-03-01T05:59:59.999Z'::timestamptz
ORDER BY refund_created_at ASC;
SQL

echo ""
echo "=== Summary totals ==="
psql "$DATABASE_URL" <<'SQL'
SELECT
    SUM(refund_line_items_gross_amount)::numeric as total_line_items_gross,
    SUM(refund_reported_amount)::numeric as total_reported,
    SUM(refund_line_items_amount)::numeric as total_line_items_net,
    COUNT(*) as event_count
FROM order_refund_event_v1
WHERE refund_created_at >= '2026-02-28T06:00:00.000Z'::timestamptz
  AND refund_created_at <= '2026-03-01T05:59:59.999Z'::timestamptz;
SQL
