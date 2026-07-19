-- ── Profit allocation by owner share % ──────────────────────────────
-- Period-close routine: distributes a period's net profit (or loss) across
-- owners in proportion to `owners.profit_share_pct`, moving it out of Retained
-- Earnings and into each owner's capital.
--
-- GL (net profit):
--   DR Retained Earnings (3200)      net profit
--     CR Owner's Capital (3100)        per owner, carrying owner_id
-- A net LOSS reverses the direction (DR Owner's Capital / CR Retained Earnings).
--
-- The P&L itself stays computed live from journal lines by date range — this
-- does NOT close revenue/expense accounts. It only allocates the resulting
-- profit figure to the partners, so each owner's capital reflects their share.

-- ── 1. Allocation header (one per period) ───────────────────────────
create table if not exists profit_allocations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  serial_number text,
  period_start  date not null,
  period_end    date not null,
  net_profit    numeric(15,2) not null,   -- negative ⇒ loss
  notes         text,
  created_at    timestamptz not null default now(),
  check (period_end >= period_start)
);
create index if not exists profit_allocations_tenant_idx on profit_allocations(tenant_id);
create index if not exists profit_allocations_period_idx on profit_allocations(tenant_id, period_start, period_end);

-- ── 2. Per-owner allocation lines ───────────────────────────────────
-- share_pct is SNAPSHOT at allocation time: an owner's share may change later,
-- and a historical allocation must keep the split it was actually posted with.
create table if not exists profit_allocation_lines (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  allocation_id uuid not null references profit_allocations(id) on delete cascade,
  owner_id      uuid not null references owners(id) on delete restrict,
  share_pct     numeric(7,4) not null,
  amount        numeric(15,2) not null,   -- negative ⇒ share of a loss
  created_at    timestamptz not null default now(),
  unique (allocation_id, owner_id)
);
create index if not exists profit_allocation_lines_alloc_idx  on profit_allocation_lines(allocation_id);
create index if not exists profit_allocation_lines_owner_idx  on profit_allocation_lines(owner_id);
create index if not exists profit_allocation_lines_tenant_idx on profit_allocation_lines(tenant_id);

-- ── 3. Row-level security (same JWT expression as 0025 / 0026 / 0036) ──
alter table profit_allocations      enable row level security;
alter table profit_allocation_lines enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['profit_allocations','profit_allocation_lines'] loop
    execute format($f$
      create policy "%1$s: tenant select" on %1$s for select
        using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
      create policy "%1$s: tenant insert" on %1$s for insert
        with check (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
      create policy "%1$s: tenant update" on %1$s for update
        using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
      create policy "%1$s: tenant delete" on %1$s for delete
        using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
    $f$, tbl);
  end loop;
end $$;

-- ── 4. Serial allocator: add profit_allocation (PA) ─────────────────
create or replace function next_document_serial(
  p_tenant_id uuid,
  p_doc_type  text,
  p_date      date
) returns text
language plpgsql
as $$
declare
  v_year   integer := extract(year from p_date)::int;
  v_number integer;
  v_prefix text;
begin
  v_prefix := case p_doc_type
    when 'purchase_order'     then 'PO'
    when 'sale_invoice'       then 'SI'
    when 'purchase_return'    then 'PR'
    when 'sale_return'        then 'SR'
    when 'ar_receipt'         then 'RCP'
    when 'ap_payment'         then 'PAY'
    when 'customer_refund'    then 'REF'
    when 'supplier_refund'    then 'RCV'
    when 'employee_loan'      then 'LN'
    when 'loan_repayment'     then 'LR'
    when 'owner_withdrawal'   then 'OW'
    when 'owner_contribution' then 'OC'
    when 'profit_allocation'  then 'PA'
    else 'DOC'
  end;

  insert into document_serials (tenant_id, doc_type, year, last_number)
  values (p_tenant_id, p_doc_type, v_year, 1)
  on conflict (tenant_id, doc_type, year)
  do update set last_number = document_serials.last_number + 1
  returning last_number into v_number;

  return v_prefix || '-' || v_year || '-' || lpad(v_number::text, 4, '0');
end;
$$;

-- ── 5. Give 3200 Retained Earnings a system_key ─────────────────────
-- `postJournalEntry` resolves accounts by system_key ONLY, so 3200 was
-- unreachable from posting code until now. Redefine the seed for new tenants,
-- then backfill BOTH the missing row and the missing key on existing tenants.
create or replace function seed_standard_coa(p_tenant_id uuid) returns void
language plpgsql
as $$
begin
  insert into chart_of_accounts
    (tenant_id, code, name, account_type, parent_code, is_header, is_system, system_key)
  values
    -- ── ASSETS ──────────────────────────────────────────────
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
    -- ── LIABILITIES ─────────────────────────────────────────
    (p_tenant_id,'2000','LIABILITIES',                'liability',null,   true,  true,  null),
    (p_tenant_id,'2100','Current Liabilities',        'liability','2000', true,  true,  null),
    (p_tenant_id,'2110','Accounts Payable',           'liability','2100', false, true,  'accounts_payable'),
    (p_tenant_id,'2120','Short-term Borrowings',      'liability','2100', false, false, null),
    (p_tenant_id,'2130','Accrued Expenses',           'liability','2100', false, false, null),
    (p_tenant_id,'2140','Sales Tax Payable',          'liability','2100', false, false, null),
    (p_tenant_id,'2200','Non-Current Liabilities',    'liability','2000', true,  false, null),
    (p_tenant_id,'2210','Long-term Loans',            'liability','2200', false, false, null),
    -- ── EQUITY ──────────────────────────────────────────────
    (p_tenant_id,'3000','EQUITY',                     'equity',   null,   true,  true,  null),
    (p_tenant_id,'3100','Owner''s Capital',           'equity',   '3000', false, true,  'owners_capital'),
    (p_tenant_id,'3200','Retained Earnings',          'equity',   '3000', false, true,  'retained_earnings'),
    (p_tenant_id,'3300','Opening Balance Equity',     'equity',   '3000', false, true,  'opening_balance_equity'),
    (p_tenant_id,'3400','Owner''s Drawings',          'equity',   '3000', false, true,  'owners_drawings'),
    -- ── REVENUE ─────────────────────────────────────────────
    (p_tenant_id,'4000','REVENUE',                    'revenue',  null,   true,  true,  null),
    (p_tenant_id,'4100','Sales Revenue',              'revenue',  '4000', false, true,  'sales_revenue'),
    (p_tenant_id,'4110','Sales Returns & Allowances', 'revenue',  '4000', false, true,  'sales_returns_contra'),
    (p_tenant_id,'4200','Other Income',               'revenue',  '4000', false, false, null),
    -- ── COST OF SALES ───────────────────────────────────────
    (p_tenant_id,'5000','COST OF SALES',              'expense',  null,   true,  true,  null),
    (p_tenant_id,'5100','Cost of Goods Sold',         'expense',  '5000', false, true,  'cogs'),
    (p_tenant_id,'5110','Purchase Returns (Contra)',  'expense',  '5000', false, true,  'purchase_returns_contra'),
    -- ── OPERATING EXPENSES ──────────────────────────────────
    (p_tenant_id,'6000','OPERATING EXPENSES',         'expense',  null,   true,  false, null),
    (p_tenant_id,'6100','Salaries & Wages',           'expense',  '6000', false, true,  'salaries_wages'),
    (p_tenant_id,'6200','Rent',                       'expense',  '6000', false, false, null),
    (p_tenant_id,'6300','Utilities',                  'expense',  '6000', false, false, null),
    (p_tenant_id,'6400','Transportation & Freight',   'expense',  '6000', false, false, null),
    (p_tenant_id,'6500','Commission Expense',         'expense',  '6000', false, false, null),
    (p_tenant_id,'6600','Printing & Stationery',      'expense',  '6000', false, false, null),
    (p_tenant_id,'6700','Telephone & Internet',       'expense',  '6000', false, false, null),
    (p_tenant_id,'6800','Repair & Maintenance',       'expense',  '6000', false, false, null),
    -- ── FINANCIAL CHARGES ───────────────────────────────────
    (p_tenant_id,'7000','FINANCIAL CHARGES',          'expense',  null,   true,  false, null),
    (p_tenant_id,'7100','Bank Charges',               'expense',  '7000', false, false, null),
    (p_tenant_id,'7200','Interest Expense',           'expense',  '7000', false, false, null)
  on conflict (tenant_id, code) do nothing;
end;
$$;

-- Backfill the row for any tenant missing it.
do $$
declare
  t record;
begin
  for t in select id from tenants loop
    perform seed_standard_coa(t.id);
  end loop;
end $$;

-- Existing tenants already HAVE a 3200 row (so the insert above is a no-op for
-- them) but with system_key null — set it. Guarded against colliding with a
-- tenant that somehow already assigned the key to another account.
update chart_of_accounts c
   set system_key = 'retained_earnings'
 where c.code = '3200'
   and c.system_key is null
   and not exists (
     select 1 from chart_of_accounts o
      where o.tenant_id = c.tenant_id
        and o.system_key = 'retained_earnings'
   );
