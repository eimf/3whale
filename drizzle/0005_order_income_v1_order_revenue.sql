-- Add order_revenue: Net Order Revenue = Gross Sales - Discounts + Shipping - Refunds (computed at sync = income_neto)

ALTER TABLE "order_income_v1"
  ADD COLUMN IF NOT EXISTS "order_revenue" numeric(10, 2);
