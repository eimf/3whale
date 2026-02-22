-- Income v1 sync (single-store). Money NUMERIC(20,6); raw JSONB.
-- Single source of truth: docs/metrics/income_v1_contract.md

CREATE TABLE IF NOT EXISTS "shop_config" (
  "id" text PRIMARY KEY NOT NULL,
  "shop_domain" text NOT NULL,
  "timezone_iana" text NOT NULL,
  "currency_code" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sync_state" (
  "id" text PRIMARY KEY NOT NULL,
  "watermark_processed_at" timestamptz,
  "last_sync_started_at" timestamptz,
  "last_sync_finished_at" timestamptz,
  "last_sync_status" text,
  "last_sync_error" text
);

CREATE TABLE IF NOT EXISTS "shopify_order_raw" (
  "shopify_order_id" text PRIMARY KEY NOT NULL,
  "processed_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "shopify_order_raw_processed_at" ON "shopify_order_raw" ("processed_at");

CREATE TABLE IF NOT EXISTS "order_income_v1" (
  "shopify_order_id" text PRIMARY KEY NOT NULL,
  "currency_code" text NOT NULL,
  "processed_at" timestamptz NOT NULL,
  "line_items_subtotal" numeric(20, 6) NOT NULL,
  "shipping_amount" numeric(20, 6) NOT NULL,
  "tax_amount" numeric(20, 6) NOT NULL,
  "discount_amount" numeric(20, 6) NOT NULL,
  "income_bruto" numeric(20, 6) NOT NULL,
  "refunds" numeric(20, 6) NOT NULL,
  "income_neto" numeric(20, 6) NOT NULL,
  "excluded" boolean NOT NULL DEFAULT false,
  "excluded_reason" text,
  "computed_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "order_income_v1_processed_at" ON "order_income_v1" ("processed_at");
CREATE INDEX IF NOT EXISTS "order_income_v1_excluded" ON "order_income_v1" ("excluded");

CREATE TABLE IF NOT EXISTS "sync_run_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "started_at" timestamptz NOT NULL,
  "finished_at" timestamptz,
  "status" text NOT NULL,
  "orders_fetched" integer NOT NULL DEFAULT 0,
  "orders_upserted" integer NOT NULL DEFAULT 0,
  "orders_excluded" integer NOT NULL DEFAULT 0,
  "last_cursor" text,
  "error" text
);
