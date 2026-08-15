
-- Suppliers
CREATE TABLE suppliers (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                            TEXT NOT NULL,
  opening_balance                 NUMERIC(15,2) NOT NULL DEFAULT 0,
  opening_balance_currency        CHAR(3)       NOT NULL DEFAULT 'PKR',
  opening_balance_pkr_equivalent  NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers: tenant select"  ON suppliers FOR SELECT  TO authenticated USING      (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
CREATE POLICY "suppliers: tenant insert"  ON suppliers FOR INSERT  TO authenticated WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
CREATE POLICY "suppliers: tenant update"  ON suppliers FOR UPDATE  TO authenticated USING      (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID) WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE INDEX idx_suppliers_tenant_id ON suppliers (tenant_id);

-- Purchase orders
CREATE TABLE purchase_orders (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id    UUID         NOT NULL REFERENCES suppliers(id),
  stock_item_id  UUID         NOT NULL REFERENCES inventory_lots(id),
  quantity       NUMERIC(15,3) NOT NULL,
  rate           NUMERIC(15,2) NOT NULL,
  currency_code  CHAR(3)       NOT NULL,
  exchange_rate  NUMERIC(10,4) NOT NULL DEFAULT 1,
  pkr_equivalent NUMERIC(15,2) NOT NULL,
  advance_paid   NUMERIC(15,2) NOT NULL DEFAULT 0,
  date           DATE          NOT NULL,
  confirmed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_orders: tenant select"  ON purchase_orders FOR SELECT  TO authenticated USING      (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
CREATE POLICY "purchase_orders: tenant insert"  ON purchase_orders FOR INSERT  TO authenticated WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
CREATE POLICY "purchase_orders: tenant update"  ON purchase_orders FOR UPDATE  TO authenticated USING      (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID) WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE INDEX idx_purchase_orders_tenant_id    ON purchase_orders (tenant_id);
CREATE INDEX idx_purchase_orders_supplier_id  ON purchase_orders (tenant_id, supplier_id);
CREATE INDEX idx_purchase_orders_date         ON purchase_orders (tenant_id, date DESC);

-- AP Payments
CREATE TABLE ap_payments (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id          UUID         NOT NULL REFERENCES suppliers(id),
  amount               NUMERIC(15,2) NOT NULL,
  currency_code        CHAR(3)       NOT NULL DEFAULT 'PKR',
  pkr_equivalent       NUMERIC(15,2) NOT NULL,
  payment_method_note  TEXT,
  date                 DATE          NOT NULL,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE ap_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ap_payments: tenant select"  ON ap_payments FOR SELECT  TO authenticated USING      (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
CREATE POLICY "ap_payments: tenant insert"  ON ap_payments FOR INSERT  TO authenticated WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
CREATE POLICY "ap_payments: tenant update"  ON ap_payments FOR UPDATE  TO authenticated USING      (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID) WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE INDEX idx_ap_payments_tenant_id    ON ap_payments (tenant_id);
CREATE INDEX idx_ap_payments_supplier_id  ON ap_payments (tenant_id, supplier_id);

-- Add deferred FK: inventory_lots.default_supplier_id → suppliers
ALTER TABLE inventory_lots
  ADD CONSTRAINT fk_inventory_lots_supplier
  FOREIGN KEY (default_supplier_id) REFERENCES suppliers(id);
