-- ── Split post-dated cheques into an asset and a liability ──────────
-- Account 1112 held BOTH cheques received from customers (money owed TO us —
-- an asset) and cheques we issued to suppliers (money we owe — a liability).
-- Netted into one asset account, the issued side dragged the balance negative
-- (about -8.27M on the main tenant), so the Balance Sheet showed a negative
-- current asset — a liability wearing an asset's clothes.
--
-- From here the two sides live in separate accounts:
--   1112 Post-Dated Cheques Received  (asset)     — cheques in hand
--   2115 Post-Dated Cheques Issued    (liability) — cheques we have written
-- The application picks between them by document direction: a cheque coming in
-- posts to 1112, a cheque going out to 2115.

-- ── 1. Seed both accounts for new tenants ──────────────────────────
-- Redefine the standard chart so a fresh tenant gets the liability account and
-- the renamed asset. ON CONFLICT leaves existing rows untouched, so the rename
-- and the new row are applied to current tenants by the explicit steps below.
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
    (p_tenant_id,'1112','Post-Dated Cheques Received','asset',    '1100', false, true,  'post_dated_cheques'),
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
    (p_tenant_id,'2115','Post-Dated Cheques Issued',  'liability','2100', false, true,  'post_dated_cheques_payable'),
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

-- ── 2. Apply to existing tenants ───────────────────────────────────
-- Rename the asset (its system_key is unchanged, so every existing posting and
-- the whole application still resolve to it) and add the new liability row.
UPDATE chart_of_accounts
   SET name = 'Post-Dated Cheques Received'
 WHERE system_key = 'post_dated_cheques'
   AND name = 'Post-Dated Cheques';

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM seed_standard_coa(t.id);
  END LOOP;
END $$;

-- ── 3. Reclassify the issued cheques already on 1112 ───────────────
-- Move every 1112 journal line that belongs to a money-OUT document to 2115.
-- Those lines recorded cheques we WROTE, so they are liabilities and were only
-- ever on 1112 because there was one combined account. Money-IN documents
-- (ar_receipt, supplier_refund, loan_repayment, owner capital) stay on 1112,
-- as do the opening-balance and its clearing entry, which are asset-side and
-- net to zero.
--
-- Direction is read from the owning entry's source_type; owner transactions
-- are split by txn_type. A PDC settlement (pdc_cleared/pdc_bounced) is moved
-- only when the cheque it settled was itself an OUT cheque — traced through
-- the tender line. None exist yet, but the rule is written to be correct.
WITH out_entries AS (
  SELECT je.id
    FROM tajir_journal_entries je
   WHERE je.source_type IN ('ap_payment','customer_refund','employee_loan')
  UNION
  SELECT je.id
    FROM tajir_journal_entries je
    JOIN owner_transactions ot ON ot.id = je.source_id
   WHERE je.source_type = 'owner_transaction' AND ot.txn_type = 'withdrawal'
  UNION
  SELECT je.id
    FROM tajir_journal_entries je
    JOIN ap_payment_lines l ON l.id = je.source_id
   WHERE je.source_type IN ('pdc_cleared','pdc_bounced')
  UNION
  SELECT je.id
    FROM tajir_journal_entries je
    JOIN customer_refund_lines l ON l.id = je.source_id
   WHERE je.source_type IN ('pdc_cleared','pdc_bounced')
  UNION
  SELECT je.id
    FROM tajir_journal_entries je
    JOIN loan_disbursement_lines l ON l.id = je.source_id
   WHERE je.source_type IN ('pdc_cleared','pdc_bounced')
)
UPDATE tajir_journal_entry_lines jl
   SET account_id = payable.id
  FROM chart_of_accounts asset, chart_of_accounts payable
 WHERE jl.account_id      = asset.id
   AND asset.system_key   = 'post_dated_cheques'
   AND payable.tenant_id  = asset.tenant_id
   AND payable.system_key = 'post_dated_cheques_payable'
   AND jl.journal_entry_id IN (SELECT id FROM out_entries);
