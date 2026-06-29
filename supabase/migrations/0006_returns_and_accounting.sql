-- ============================================================
-- 0006: Purchase Returns, Sale Returns, Chart of Accounts,
--       Journal Entries (Double-Entry GL), Voucher Counters
-- ============================================================

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

-- ── Chart of Accounts ────────────────────────────────────────
CREATE TABLE "chart_of_accounts" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"    uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "code"         varchar(10) NOT NULL,
  "name"         text NOT NULL,
  "account_type" text NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  "parent_code"  varchar(10),
  "is_header"    boolean NOT NULL DEFAULT false,
  "is_system"    boolean NOT NULL DEFAULT false,
  "system_key"   text,
  "is_active"    boolean NOT NULL DEFAULT true,
  "created_at"   timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_chart_of_accounts_tenant_code" UNIQUE("tenant_id", "code")
);

-- ── Voucher Number Counters ───────────────────────────────────
CREATE TABLE "tenant_counters" (
  "tenant_id"     uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "counter_name"  text NOT NULL,
  "current_value" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("tenant_id", "counter_name")
);

-- ── Journal Entries (Voucher Header) ─────────────────────────
-- Named tajir_journal_entries to avoid conflict with legacy journal_entries table
CREATE TABLE "tajir_journal_entries" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"      uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "voucher_number" text NOT NULL,
  "date"           date NOT NULL,
  "description"    text,
  "reference"      text,
  "source_type"    text NOT NULL DEFAULT 'manual',
  "source_id"      uuid,
  "created_at"     timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_journal_entries_tenant_voucher" UNIQUE("tenant_id", "voucher_number")
);

-- ── Journal Entry Lines (Debit / Credit) ─────────────────────
CREATE TABLE "tajir_journal_entry_lines" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "journal_entry_id" uuid NOT NULL REFERENCES "tajir_journal_entries"("id") ON DELETE CASCADE,
  "tenant_id"        uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "account_id"       uuid NOT NULL REFERENCES "chart_of_accounts"("id"),
  "description"      text,
  "debit"            numeric(15, 2) NOT NULL DEFAULT '0',
  "credit"           numeric(15, 2) NOT NULL DEFAULT '0',
  "customer_id"      uuid REFERENCES "tajir_customers"("id"),
  "supplier_id"      uuid REFERENCES "suppliers"("id"),
  "stock_item_id"    uuid REFERENCES "inventory_lots"("id"),
  "created_at"       timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_jel_debit_credit" CHECK (
    debit >= 0 AND credit >= 0 AND NOT (debit > 0 AND credit > 0)
  )
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE "purchase_returns"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_returns"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chart_of_accounts"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_counters"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tajir_journal_entries"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tajir_journal_entry_lines" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_returns_tenant_isolation"
  ON "purchase_returns" FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

CREATE POLICY "sale_returns_tenant_isolation"
  ON "sale_returns" FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

CREATE POLICY "chart_of_accounts_tenant_isolation"
  ON "chart_of_accounts" FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

CREATE POLICY "tenant_counters_tenant_isolation"
  ON "tenant_counters" FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

CREATE POLICY "tajir_journal_entries_tenant_isolation"
  ON "tajir_journal_entries" FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

CREATE POLICY "tajir_journal_entry_lines_tenant_isolation"
  ON "tajir_journal_entry_lines" FOR ALL TO authenticated
  USING (tenant_id::text = auth.jwt() -> 'app_metadata' ->> 'tenant_id');

-- ── Helper: atomic voucher number generation ─────────────────
CREATE OR REPLACE FUNCTION get_next_voucher_number(
  p_tenant_id   uuid,
  p_prefix      text DEFAULT 'JV'
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next  integer;
  v_year  text;
BEGIN
  INSERT INTO tenant_counters (tenant_id, counter_name, current_value)
  VALUES (p_tenant_id, p_prefix, 1)
  ON CONFLICT (tenant_id, counter_name)
  DO UPDATE SET current_value = tenant_counters.current_value + 1
  RETURNING current_value INTO v_next;

  v_year := to_char(CURRENT_DATE, 'YYYY');
  RETURN p_prefix || '-' || v_year || '-' || lpad(v_next::text, 4, '0');
END;
$$;

-- ── Pakistani Standard Chart of Accounts (ICAP/SECP) ─────────
CREATE OR REPLACE FUNCTION seed_standard_coa(p_tenant_id uuid) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO chart_of_accounts
    (tenant_id, code, name, account_type, parent_code, is_header, is_system, system_key)
  VALUES
    -- ── ASSETS ──────────────────────────────────────────────
    (p_tenant_id,'1000','ASSETS',                    'asset',    NULL,   true,  true,  NULL),
    (p_tenant_id,'1100','Current Assets',             'asset',    '1000', true,  true,  NULL),
    (p_tenant_id,'1110','Cash in Hand',               'asset',    '1100', false, true,  'cash_in_hand'),
    (p_tenant_id,'1120','Cash at Bank',               'asset',    '1100', false, true,  'cash_at_bank'),
    (p_tenant_id,'1130','Accounts Receivable',        'asset',    '1100', false, true,  'accounts_receivable'),
    (p_tenant_id,'1140','Stock in Trade',             'asset',    '1100', false, true,  'inventory'),
    (p_tenant_id,'1150','Advances & Deposits',        'asset',    '1100', false, false, NULL),
    (p_tenant_id,'1160','Prepaid Expenses',           'asset',    '1100', false, false, NULL),
    (p_tenant_id,'1200','Non-Current Assets',         'asset',    '1000', true,  false, NULL),
    (p_tenant_id,'1210','Property, Plant & Equipment','asset',    '1200', false, false, NULL),
    (p_tenant_id,'1220','Accumulated Depreciation',   'asset',    '1200', false, false, NULL),
    -- ── LIABILITIES ─────────────────────────────────────────
    (p_tenant_id,'2000','LIABILITIES',                'liability',NULL,   true,  true,  NULL),
    (p_tenant_id,'2100','Current Liabilities',        'liability','2000', true,  true,  NULL),
    (p_tenant_id,'2110','Accounts Payable',           'liability','2100', false, true,  'accounts_payable'),
    (p_tenant_id,'2120','Short-term Borrowings',      'liability','2100', false, false, NULL),
    (p_tenant_id,'2130','Accrued Expenses',           'liability','2100', false, false, NULL),
    (p_tenant_id,'2140','Sales Tax Payable',          'liability','2100', false, false, NULL),
    (p_tenant_id,'2200','Non-Current Liabilities',    'liability','2000', true,  false, NULL),
    (p_tenant_id,'2210','Long-term Loans',            'liability','2200', false, false, NULL),
    -- ── EQUITY ──────────────────────────────────────────────
    (p_tenant_id,'3000','EQUITY',                     'equity',   NULL,   true,  true,  NULL),
    (p_tenant_id,'3100','Owner''s Capital',           'equity',   '3000', false, true,  'owners_capital'),
    (p_tenant_id,'3200','Retained Earnings',          'equity',   '3000', false, false, NULL),
    -- ── REVENUE ─────────────────────────────────────────────
    (p_tenant_id,'4000','REVENUE',                    'revenue',  NULL,   true,  true,  NULL),
    (p_tenant_id,'4100','Sales Revenue',              'revenue',  '4000', false, true,  'sales_revenue'),
    (p_tenant_id,'4110','Sales Returns & Allowances', 'revenue',  '4000', false, true,  'sales_returns_contra'),
    (p_tenant_id,'4200','Other Income',               'revenue',  '4000', false, false, NULL),
    -- ── COST OF SALES ───────────────────────────────────────
    (p_tenant_id,'5000','COST OF SALES',              'expense',  NULL,   true,  true,  NULL),
    (p_tenant_id,'5100','Cost of Goods Sold',         'expense',  '5000', false, true,  'cogs'),
    (p_tenant_id,'5110','Purchase Returns (Contra)',  'expense',  '5000', false, true,  'purchase_returns_contra'),
    -- ── OPERATING EXPENSES ──────────────────────────────────
    (p_tenant_id,'6000','OPERATING EXPENSES',         'expense',  NULL,   true,  false, NULL),
    (p_tenant_id,'6100','Salaries & Wages',           'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6200','Rent',                       'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6300','Utilities',                  'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6400','Transportation & Freight',   'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6500','Commission Expense',         'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6600','Printing & Stationery',      'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6700','Telephone & Internet',       'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6800','Repair & Maintenance',       'expense',  '6000', false, false, NULL),
    -- ── FINANCIAL CHARGES ───────────────────────────────────
    (p_tenant_id,'7000','FINANCIAL CHARGES',          'expense',  NULL,   true,  false, NULL),
    (p_tenant_id,'7100','Bank Charges',               'expense',  '7000', false, false, NULL),
    (p_tenant_id,'7200','Interest Expense',           'expense',  '7000', false, false, NULL)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;

-- Seed for all existing tenants
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM seed_standard_coa(t.id);
  END LOOP;
END;
$$;
