
CREATE TABLE inventory_lots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  code             TEXT,
  count            TEXT NOT NULL,
  type             TEXT CHECK (type IN ('Combed', 'Carded')),
  fiber            TEXT,
  lot              TEXT,
  -- default_supplier_id has no FK yet; constraint added in migration 3 after suppliers table exists
  default_supplier_id UUID,
  current_quantity NUMERIC(15,3) NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inventory_lots_tenant_name UNIQUE (tenant_id, name)
);

ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own tenant's stock items
CREATE POLICY "inventory_lots: tenant select"
  ON inventory_lots FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

-- Authenticated users can insert into their own tenant
CREATE POLICY "inventory_lots: tenant insert"
  ON inventory_lots FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

-- Authenticated users can update their own tenant's rows
CREATE POLICY "inventory_lots: tenant update"
  ON inventory_lots FOR UPDATE
  TO authenticated
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID)
  WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

-- Index for fast tenant-scoped lookups
CREATE INDEX idx_inventory_lots_tenant_id ON inventory_lots (tenant_id);
CREATE INDEX idx_inventory_lots_tenant_lot ON inventory_lots (tenant_id, lot) WHERE lot IS NOT NULL;
