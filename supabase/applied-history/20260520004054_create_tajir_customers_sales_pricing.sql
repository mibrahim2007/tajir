
-- Tajir customers (prefixed to avoid conflict with existing `customers` from other app)
CREATE TABLE tajir_customers (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                            TEXT NOT NULL,
  opening_balance                 NUMERIC(15,2) NOT NULL DEFAULT 0,
  opening_balance_currency        CHAR(3)       NOT NULL DEFAULT 'PKR',
  opening_balance_pkr_equivalent  NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at                      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE tajir_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tajir_customers: tenant select"  ON tajir_customers FOR SELECT  TO authenticated USING      (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID);
CREATE POLICY "tajir_customers: tenant insert"  ON tajir_customers FOR INSERT  TO authenticated WITH CHECK (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID);
CREATE POLICY "tajir_customers: tenant update"  ON tajir_customers FOR UPDATE  TO authenticated USING      (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID) WITH CHECK (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID);
CREATE INDEX idx_tajir_customers_tenant_id ON tajir_customers (tenant_id);

-- Sales Orders
CREATE TABLE sales_orders (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id      UUID          NOT NULL REFERENCES tajir_customers(id),
  stock_item_id    UUID          NOT NULL REFERENCES inventory_lots(id),
  quantity         NUMERIC(15,3) NOT NULL,
  rate             NUMERIC(15,2) NOT NULL,
  currency_code    CHAR(3)       NOT NULL,
  exchange_rate    NUMERIC(10,4) NOT NULL DEFAULT 1,
  pkr_equivalent   NUMERIC(15,2) NOT NULL,
  date             DATE          NOT NULL,
  payment_due_date DATE,
  confirmed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_orders: tenant select"  ON sales_orders FOR SELECT  TO authenticated USING      (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID);
CREATE POLICY "sales_orders: tenant insert"  ON sales_orders FOR INSERT  TO authenticated WITH CHECK (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID);
CREATE POLICY "sales_orders: tenant update"  ON sales_orders FOR UPDATE  TO authenticated USING      (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID) WITH CHECK (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID);
CREATE INDEX idx_sales_orders_tenant_id   ON sales_orders (tenant_id);
CREATE INDEX idx_sales_orders_customer_id ON sales_orders (tenant_id, customer_id);
CREATE INDEX idx_sales_orders_date        ON sales_orders (tenant_id, date DESC);

-- AR Receipts
CREATE TABLE ar_receipts (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id         UUID          NOT NULL REFERENCES tajir_customers(id),
  amount              NUMERIC(15,2) NOT NULL,
  currency_code       CHAR(3)       NOT NULL DEFAULT 'PKR',
  pkr_equivalent      NUMERIC(15,2) NOT NULL,
  payment_method_note TEXT,
  date                DATE          NOT NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE ar_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ar_receipts: tenant select"  ON ar_receipts FOR SELECT  TO authenticated USING      (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID);
CREATE POLICY "ar_receipts: tenant insert"  ON ar_receipts FOR INSERT  TO authenticated WITH CHECK (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID);
CREATE POLICY "ar_receipts: tenant update"  ON ar_receipts FOR UPDATE  TO authenticated USING      (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID) WITH CHECK (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID);
CREATE INDEX idx_ar_receipts_tenant_id   ON ar_receipts (tenant_id);
CREATE INDEX idx_ar_receipts_customer_id ON ar_receipts (tenant_id, customer_id);

-- Customer Price Lists
CREATE TABLE customer_price_lists (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id    UUID          NOT NULL REFERENCES tajir_customers(id),
  stock_item_id  UUID          NOT NULL REFERENCES inventory_lots(id),
  rate           NUMERIC(15,2) NOT NULL,
  is_active      BOOLEAN       NOT NULL DEFAULT true,
  effective_from TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  superseded_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE customer_price_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_price_lists: tenant select"  ON customer_price_lists FOR SELECT  TO authenticated USING      (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID);
CREATE POLICY "customer_price_lists: tenant insert"  ON customer_price_lists FOR INSERT  TO authenticated WITH CHECK (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID);
CREATE POLICY "customer_price_lists: tenant update"  ON customer_price_lists FOR UPDATE  TO authenticated USING      (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID) WITH CHECK (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::UUID);
CREATE INDEX idx_customer_price_lists_tenant_id ON customer_price_lists (tenant_id);

-- One active pricing rule per tenant+customer+item
CREATE UNIQUE INDEX uq_active_price_rule
  ON customer_price_lists (tenant_id, customer_id, stock_item_id)
  WHERE is_active = true;
