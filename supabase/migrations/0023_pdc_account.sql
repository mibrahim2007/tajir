-- ── Post-Dated Cheques (PDC) account ─────────────────────────
-- Adds account 1112 "Post-Dated Cheques" (system_key 'post_dated_cheques')
-- under Current Assets (1100). Receipts/payments recorded as PDC post their
-- money leg here instead of Cash in Hand / Cash at Bank. Because GL posting
-- resolves accounts by system_key, the account must carry a system_key.

-- Redefine the standard CoA seed so newly-created tenants also get 1112.
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
    (p_tenant_id,'1112','Post-Dated Cheques',         'asset',    '1100', false, true,  'post_dated_cheques'),
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

-- Fix any pre-existing 1112 account that was created manually without a
-- system_key (posting resolves accounts by system_key, so a NULL key makes
-- the account unpostable). Scoped to code 1112 with a missing key.
UPDATE chart_of_accounts
   SET system_key = 'post_dated_cheques',
       is_system  = true
 WHERE code = '1112'
   AND system_key IS NULL;

-- Backfill 1112 for all existing tenants (only inserts the missing row;
-- tenants that already have a 1112 are left untouched by ON CONFLICT).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM seed_standard_coa(t.id);
  END LOOP;
END $$;
