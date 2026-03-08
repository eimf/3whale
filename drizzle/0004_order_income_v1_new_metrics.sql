-- Add columns for 7 new Shopify metrics: customer_id, is_new_customer, units_sold, shipping_total, tax_total

ALTER TABLE "order_income_v1"
  ADD COLUMN IF NOT EXISTS "customer_id" text,
  ADD COLUMN IF NOT EXISTS "is_new_customer" boolean,
  ADD COLUMN IF NOT EXISTS "units_sold" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "shipping_total" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "tax_total" numeric(10, 2);

CREATE INDEX IF NOT EXISTS "order_income_v1_customer_id" ON "order_income_v1" ("customer_id");
CREATE INDEX IF NOT EXISTS "order_income_v1_is_new_customer" ON "order_income_v1" ("is_new_customer");
