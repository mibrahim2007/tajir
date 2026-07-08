-- 0022_account_opening_balance.sql
-- Introduces an "Opening Balance Equity" system account (code 3300) used as the
-- balancing contra side when an owner sets a per-account opening balance.
-- Opening balances are posted as source_type='opening_balance' journal entries
-- so they flow into Trial Balance / Balance Sheet / General Ledger automatically.

-- 1) Include Opening Balance Equity in the standard CoA seed for NEW tenants.
CREATE OR REPLACE FUNCTION public.seed_standard_coa(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO chart_of_accounts
    (tenant_id, code, name, account_type, parent_code, is_header, is_system, system_key)
  VALUES
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
    (p_tenant_id,'2000','LIABILITIES',                'liability',NULL,   true,  true,  NULL),
    (p_tenant_id,'2100','Current Liabilities',        'liability','2000', true,  true,  NULL),
    (p_tenant_id,'2110','Accounts Payable',           'liability','2100', false, true,  'accounts_payable'),
    (p_tenant_id,'2120','Short-term Borrowings',      'liability','2100', false, false, NULL),
    (p_tenant_id,'2130','Accrued Expenses',           'liability','2100', false, false, NULL),
    (p_tenant_id,'2140','Sales Tax Payable',          'liability','2100', false, false, NULL),
    (p_tenant_id,'2200','Non-Current Liabilities',    'liability','2000', true,  false, NULL),
    (p_tenant_id,'2210','Long-term Loans',            'liability','2200', false, false, NULL),
    (p_tenant_id,'3000','EQUITY',                     'equity',   NULL,   true,  true,  NULL),
    (p_tenant_id,'3100','Owner''s Capital',           'equity',   '3000', false, true,  'owners_capital'),
    (p_tenant_id,'3200','Retained Earnings',          'equity',   '3000', false, false, NULL),
    (p_tenant_id,'3300','Opening Balance Equity',     'equity',   '3000', false, true,  'opening_balance_equity'),
    (p_tenant_id,'4000','REVENUE',                    'revenue',  NULL,   true,  true,  NULL),
    (p_tenant_id,'4100','Sales Revenue',              'revenue',  '4000', false, true,  'sales_revenue'),
    (p_tenant_id,'4110','Sales Returns & Allowances', 'revenue',  '4000', false, true,  'sales_returns_contra'),
    (p_tenant_id,'4200','Other Income',               'revenue',  '4000', false, false, NULL),
    (p_tenant_id,'5000','COST OF SALES',              'expense',  NULL,   true,  true,  NULL),
    (p_tenant_id,'5100','Cost of Goods Sold',         'expense',  '5000', false, true,  'cogs'),
    (p_tenant_id,'5110','Purchase Returns (Contra)',  'expense',  '5000', false, true,  'purchase_returns_contra'),
    (p_tenant_id,'6000','OPERATING EXPENSES',         'expense',  NULL,   true,  false, NULL),
    (p_tenant_id,'6100','Salaries & Wages',           'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6200','Rent',                       'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6300','Utilities',                  'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6400','Transportation & Freight',   'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6500','Commission Expense',         'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6600','Printing & Stationery',      'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6700','Telephone & Internet',       'expense',  '6000', false, false, NULL),
    (p_tenant_id,'6800','Repair & Maintenance',       'expense',  '6000', false, false, NULL),
    (p_tenant_id,'7000','FINANCIAL CHARGES',          'expense',  NULL,   true,  false, NULL),
    (p_tenant_id,'7100','Bank Charges',               'expense',  '7000', false, false, NULL),
    (p_tenant_id,'7200','Interest Expense',           'expense',  '7000', false, false, NULL)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$function$;

-- 2) Backfill Opening Balance Equity for EXISTING tenants that already have the
--    EQUITY (3000) parent but no opening_balance_equity account yet.
INSERT INTO chart_of_accounts
  (tenant_id, code, name, account_type, parent_code, is_header, is_system, system_key)
SELECT DISTINCT c.tenant_id, '3300', 'Opening Balance Equity', 'equity', '3000', false, true, 'opening_balance_equity'
FROM chart_of_accounts c
WHERE c.code = '3000'
  AND NOT EXISTS (
    SELECT 1 FROM chart_of_accounts x
    WHERE x.tenant_id = c.tenant_id
      AND x.system_key = 'opening_balance_equity'
  )
ON CONFLICT (tenant_id, code) DO NOTHING;
