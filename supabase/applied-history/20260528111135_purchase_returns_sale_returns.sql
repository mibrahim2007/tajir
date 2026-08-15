-- ── Purchase Returns ─────────────────────────────────────────
CREATE TABLE "purchase_returns" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"         uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "purchase_order_id" uuid REFERENCES "purchase_orders"("id"),
  "supplier_id"       uuid NOT NULL REFERENCES "suppliers"("id"),
  "stock_item_id"     uuid NOT NULL REFERENCES "inventory_lots"("id"),
  "quantity"          numeric(15, 3) NOT NULL,
  "rate"              numeric(15, 2) NOT NULL,
  "currency_code"     char(3) NOT NULL DEFAULT 'PKR',
  "exchange_rate"     numeric(10, 4) NOT NULL DEFAULT '1',
  "pkr_equivalent"    numeric(15, 2) NOT NULL,
  "date"              date NOT NULL,
  "reason"            text,
  "created_at"        timestamp with time zone DEFAULT now() NOT NULL
);

-- ── Sale Returns ─────────────────────────────────────────────
CREATE TABLE "sale_returns" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"       uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "sale_order_id"   uuid REFERENCES "sales_orders"("id"),
  "customer_id"     uuid NOT NULL REFERENCES "tajir_customers"("id"),
  "stock_item_id"   uuid NOT NULL REFERENCES "inventory_lots"("id"),
  "quantity"        numeric(15, 3) NOT NULL,
  "rate"            numeric(15, 2) NOT NULL,
  "currency_code"   char(3) NOT NULL DEFAULT 'PKR',
  "exchange_rate"   numeric(10, 4) NOT NULL DEFAULT '1',
  "pkr_equivalent"  numeric(15, 2) NOT NULL,
  "date"            date NOT NULL,
  "reason"          text,
  "created_at"      timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "purchase_returns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_returns"     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_returns_tenant_isolation"
  ON "purchase_returns" FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

CREATE POLICY "sale_returns_tenant_isolation"
  ON "sale_returns" FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');