-- ── Employee Loans Phase 3: payroll salary-deduction hook ───────────
-- Lets a loan installment be recovered by withholding salary instead of cash.
-- No cash moves; the GL entry is:
--   DR Salaries & Wages (6100, system_key 'salaries_wages')
--   CR Employee Loans & Advances (1135, system_key 'employee_loans_receivable')
-- so salary expense is recognised and the loan receivable is reduced.
--
-- Requires: (1) a system_key on 6100 so post-journal-entry can resolve it,
--           (2) a `source` marker on loan_repayments to tell payroll deductions
--               (no tender lines) apart from cash repayments.

-- 1) Marker on repayments: 'manual' (cash/bank/PDC) vs 'payroll' (salary deduction).
alter table loan_repayments
  add column if not exists source text not null default 'manual';

-- 2) Give 6100 Salaries & Wages a system_key (posting resolves by system_key).
--    Only touches rows that don't already carry a key.
update chart_of_accounts
   set system_key = 'salaries_wages',
       is_system  = true
 where code = '6100'
   and system_key is null;

-- 3) Redefine the CoA seed so new tenants get 6100 with the system_key, then
--    backfill existing tenants.
create or replace function seed_standard_coa(p_tenant_id uuid) returns void
language plpgsql
as $$
begin
  insert into chart_of_accounts
    (tenant_id, code, name, account_type, parent_code, is_header, is_system, system_key)
  values
    (p_tenant_id,'1000','ASSETS',                    'asset',    null,   true,  true,  null),
    (p_tenant_id,'1100','Current Assets',             'asset',    '1000', true,  true,  null),
    (p_tenant_id,'1110','Cash in Hand',               'asset',    '1100', false, true,  'cash_in_hand'),
    (p_tenant_id,'1112','Post-Dated Cheques',         'asset',    '1100', false, true,  'post_dated_cheques'),
    (p_tenant_id,'1120','Cash at Bank',               'asset',    '1100', false, true,  'cash_at_bank'),
    (p_tenant_id,'1130','Accounts Receivable',        'asset',    '1100', false, true,  'accounts_receivable'),
    (p_tenant_id,'1135','Employee Loans & Advances',  'asset',    '1100', false, true,  'employee_loans_receivable'),
    (p_tenant_id,'1140','Stock in Trade',             'asset',    '1100', false, true,  'inventory'),
    (p_tenant_id,'1150','Advances & Deposits',        'asset',    '1100', false, false, null),
    (p_tenant_id,'1160','Prepaid Expenses',           'asset',    '1100', false, false, null),
    (p_tenant_id,'1200','Non-Current Assets',         'asset',    '1000', true,  false, null),
    (p_tenant_id,'1210','Property, Plant & Equipment','asset',    '1200', false, false, null),
    (p_tenant_id,'1220','Accumulated Depreciation',   'asset',    '1200', false, false, null),
    (p_tenant_id,'2000','LIABILITIES',                'liability',null,   true,  true,  null),
    (p_tenant_id,'2100','Current Liabilities',        'liability','2000', true,  true,  null),
    (p_tenant_id,'2110','Accounts Payable',           'liability','2100', false, true,  'accounts_payable'),
    (p_tenant_id,'2120','Short-term Borrowings',      'liability','2100', false, false, null),
    (p_tenant_id,'2130','Accrued Expenses',           'liability','2100', false, false, null),
    (p_tenant_id,'2140','Sales Tax Payable',          'liability','2100', false, false, null),
    (p_tenant_id,'2200','Non-Current Liabilities',    'liability','2000', true,  false, null),
    (p_tenant_id,'2210','Long-term Loans',            'liability','2200', false, false, null),
    (p_tenant_id,'3000','EQUITY',                     'equity',   null,   true,  true,  null),
    (p_tenant_id,'3100','Owner''s Capital',           'equity',   '3000', false, true,  'owners_capital'),
    (p_tenant_id,'3200','Retained Earnings',          'equity',   '3000', false, false, null),
    (p_tenant_id,'4000','REVENUE',                    'revenue',  null,   true,  true,  null),
    (p_tenant_id,'4100','Sales Revenue',              'revenue',  '4000', false, true,  'sales_revenue'),
    (p_tenant_id,'4110','Sales Returns & Allowances', 'revenue',  '4000', false, true,  'sales_returns_contra'),
    (p_tenant_id,'4200','Other Income',               'revenue',  '4000', false, false, null),
    (p_tenant_id,'5000','COST OF SALES',              'expense',  null,   true,  true,  null),
    (p_tenant_id,'5100','Cost of Goods Sold',         'expense',  '5000', false, true,  'cogs'),
    (p_tenant_id,'5110','Purchase Returns (Contra)',  'expense',  '5000', false, true,  'purchase_returns_contra'),
    (p_tenant_id,'6000','OPERATING EXPENSES',         'expense',  null,   true,  false, null),
    (p_tenant_id,'6100','Salaries & Wages',           'expense',  '6000', false, true,  'salaries_wages'),
    (p_tenant_id,'6200','Rent',                       'expense',  '6000', false, false, null),
    (p_tenant_id,'6300','Utilities',                  'expense',  '6000', false, false, null),
    (p_tenant_id,'6400','Transportation & Freight',   'expense',  '6000', false, false, null),
    (p_tenant_id,'6500','Commission Expense',         'expense',  '6000', false, false, null),
    (p_tenant_id,'6600','Printing & Stationery',      'expense',  '6000', false, false, null),
    (p_tenant_id,'6700','Telephone & Internet',       'expense',  '6000', false, false, null),
    (p_tenant_id,'6800','Repair & Maintenance',       'expense',  '6000', false, false, null),
    (p_tenant_id,'7000','FINANCIAL CHARGES',          'expense',  null,   true,  false, null),
    (p_tenant_id,'7100','Bank Charges',               'expense',  '7000', false, false, null),
    (p_tenant_id,'7200','Interest Expense',           'expense',  '7000', false, false, null)
  on conflict (tenant_id, code) do nothing;
end;
$$;

do $$
declare
  t record;
begin
  for t in select id from tenants loop
    perform seed_standard_coa(t.id);
  end loop;
end $$;
