ALTER TABLE "order_refund_event_v1"
  ADD COLUMN IF NOT EXISTS "refund_line_items_gross_amount" numeric(20, 6) NOT NULL DEFAULT 0;

UPDATE "order_refund_event_v1"
SET "refund_line_items_gross_amount" = "refund_line_items_amount"
WHERE "refund_line_items_gross_amount" = 0
  AND "refund_line_items_amount" <> 0;
