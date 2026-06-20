-- ============================================================
-- 0007: Locations, Location-wise Stock Transfers,
--       Location FK on purchase/sale/returns
-- ============================================================

-- Locations table
CREATE TABLE "locations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "address" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "uq_locations_tenant_name" UNIQUE("tenant_id", "name")
);

ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_locations" ON "locations"
  USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1));

-- Add location_id to transaction tables (nullable — existing records unaffected)
ALTER TABLE "purchase_orders"  ADD COLUMN "location_id" uuid REFERENCES "locations"("id") ON DELETE SET NULL;
ALTER TABLE "sales_orders"     ADD COLUMN "location_id" uuid REFERENCES "locations"("id") ON DELETE SET NULL;
ALTER TABLE "sale_returns"     ADD COLUMN "location_id" uuid REFERENCES "locations"("id") ON DELETE SET NULL;
ALTER TABLE "purchase_returns" ADD COLUMN "location_id" uuid REFERENCES "locations"("id") ON DELETE SET NULL;

-- Stock transfers table
CREATE TABLE "stock_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "from_location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "to_location_id"   uuid NOT NULL REFERENCES "locations"("id"),
  "stock_item_id"    uuid NOT NULL REFERENCES "inventory_lots"("id"),
  "quantity"         numeric(15,3) NOT NULL,
  "date"             date NOT NULL,
  "notes"            text,
  "created_at"       timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "chk_stock_transfers_diff_locations" CHECK ("from_location_id" != "to_location_id"),
  CONSTRAINT "chk_stock_transfers_qty_positive"   CHECK ("quantity" > 0)
);

ALTER TABLE "stock_transfers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_stock_transfers" ON "stock_transfers"
  USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1));

-- Indexes
CREATE INDEX "idx_locations_tenant"          ON "locations"("tenant_id");
CREATE INDEX "idx_stock_transfers_tenant"    ON "stock_transfers"("tenant_id");
CREATE INDEX "idx_stock_transfers_from_loc"  ON "stock_transfers"("from_location_id");
CREATE INDEX "idx_stock_transfers_to_loc"    ON "stock_transfers"("to_location_id");
CREATE INDEX "idx_stock_transfers_item"      ON "stock_transfers"("stock_item_id");
CREATE INDEX "idx_purchase_orders_location"  ON "purchase_orders"("location_id");
CREATE INDEX "idx_sales_orders_location"     ON "sales_orders"("location_id");
CREATE INDEX "idx_sale_returns_location"     ON "sale_returns"("location_id");
CREATE INDEX "idx_purchase_returns_location" ON "purchase_returns"("location_id");
