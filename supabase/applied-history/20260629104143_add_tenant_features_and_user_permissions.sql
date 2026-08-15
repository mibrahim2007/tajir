
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS features jsonb;
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS permissions jsonb;
