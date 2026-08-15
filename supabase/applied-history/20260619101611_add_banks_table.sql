
-- Banks master table
CREATE TABLE banks (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  account_number text,
  branch         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON banks
  USING (tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1));

-- Add bank_id to transaction tables (nullable — cash transactions have no bank)
ALTER TABLE ap_payments           ADD COLUMN bank_id uuid REFERENCES banks(id) ON DELETE SET NULL;
ALTER TABLE ar_receipts           ADD COLUMN bank_id uuid REFERENCES banks(id) ON DELETE SET NULL;
ALTER TABLE tajir_journal_entries ADD COLUMN bank_id uuid REFERENCES banks(id) ON DELETE SET NULL;
