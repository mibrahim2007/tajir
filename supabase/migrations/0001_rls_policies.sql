-- Enable RLS on all application tables
ALTER TABLE tenants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tajir_customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_receipts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_price_lists   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;

-- Helper: extract tenant_id from JWT app_metadata
-- Used in every RLS policy below
-- auth.jwt() -> 'app_metadata' ->> 'tenant_id' returns the UUID string

-- tenants: users can only see their own tenant row
CREATE POLICY "tenants_tenant_isolation"
  ON tenants FOR ALL TO authenticated
  USING (id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

-- tenant_users: scoped to tenant
CREATE POLICY "tenant_users_tenant_isolation"
  ON tenant_users FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

-- inventory_lots: scoped to tenant
CREATE POLICY "inventory_lots_tenant_isolation"
  ON inventory_lots FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

-- suppliers: scoped to tenant
CREATE POLICY "suppliers_tenant_isolation"
  ON suppliers FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

-- purchase_orders: scoped to tenant
CREATE POLICY "purchase_orders_tenant_isolation"
  ON purchase_orders FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

-- ap_payments: scoped to tenant
CREATE POLICY "ap_payments_tenant_isolation"
  ON ap_payments FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

-- tajir_customers: scoped to tenant
CREATE POLICY "tajir_customers_tenant_isolation"
  ON tajir_customers FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

-- sales_orders: scoped to tenant
CREATE POLICY "sales_orders_tenant_isolation"
  ON sales_orders FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

-- ar_receipts: scoped to tenant
CREATE POLICY "ar_receipts_tenant_isolation"
  ON ar_receipts FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

-- customer_price_lists: scoped to tenant
CREATE POLICY "customer_price_lists_tenant_isolation"
  ON customer_price_lists FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

-- audit_log: INSERT-only — no UPDATE or DELETE ever (NFR-7)
-- Authenticated users can only insert rows for their own tenant.
-- SELECT is intentionally denied here; the app reads via Drizzle (bypasses RLS).
CREATE POLICY "audit_log_insert_only"
  ON audit_log FOR INSERT TO authenticated
  WITH CHECK (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

-- Unique partial index: at most one active pricing rule per customer-item pair (FR-13)
CREATE UNIQUE INDEX uq_active_price_rule
  ON customer_price_lists (tenant_id, customer_id, stock_item_id)
  WHERE is_active = true;

-- FK: tenant_users references auth.users
ALTER TABLE tenant_users
  ADD CONSTRAINT tenant_users_user_id_auth_users_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
