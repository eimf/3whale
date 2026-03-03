ALTER TABLE "order_refund_event_v1"
  ADD COLUMN IF NOT EXISTS "refund_line_items_tax_amount" numeric(20, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refund_shipping_amount" numeric(20, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refund_shipping_tax_amount" numeric(20, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refund_duties_amount" numeric(20, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refund_order_adjustments_amount" numeric(20, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refund_order_adjustments_tax_amount" numeric(20, 6) NOT NULL DEFAULT 0;
