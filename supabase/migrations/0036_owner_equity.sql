-- ── Owner Equity module (multi-owner capital & drawings) ────────────
-- A tenant may have several owners/partners. Each owner's cash in and out
-- is tracked against a SHARED pair of equity accounts, with the individual
-- owner carried as a sub-ledger dimension (`owner_id`) on the journal line —
-- mirroring the customer/supplier/stock/employee dimensions already in use.
-- Per-owner position comes from grouping the ledger by owner_id, so adding a
-- partner never grows the chart of accounts.
--
-- GL (resolves accounts by system_key, mirroring employee loans):
--   Withdrawal:   DR Owner's Drawings (3400) / CR Cash/Bank/PDC (tender legs)
--   Contribution: DR Cash/Bank/PDC (tender legs) / CR Owner's Capital (3100)
--
-- Drawings (3400) is a contra-equity account: it reduces equity and MUST NOT
-- reach the P&L. At year end it closes into Owner's Capital.

-- ── 1. Owner master ─────────────────────────────────────────────────
create table if not exists owners (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  name             text not null,
  cnic             text,
  phone            text,
  email            text,
  -- Ownership share, used for reporting and (later) profit allocation.
  -- Not enforced to sum to 100 across owners: partners are added over time
  -- and a transient partial total is normal.
  profit_share_pct numeric(7,4) not null default 0
                     check (profit_share_pct >= 0 and profit_share_pct <= 100),
  is_active        boolean not null default true,
  notes            text,
  created_at       timestamptz not null default now()
);
create index if not exists owners_tenant_idx on owners(tenant_id);

-- ── 2. Owner transactions (capital in / drawings out) ───────────────
-- One table for both directions: identical shape (owner + date + tender
-- lines + amount), and a combined per-owner ledger is the primary read.
create table if not exists owner_transactions (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  serial_number  text,
  owner_id       uuid not null references owners(id) on delete restrict,
  txn_type       text not null check (txn_type in ('withdrawal','contribution')),
  amount         numeric(15,2) not null check (amount > 0),
  currency_code  char(3) not null default 'PKR',
  exchange_rate  numeric(10,4) not null default 1,
  pkr_equivalent numeric(15,2) not null,
  date           date not null,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists owner_transactions_tenant_idx on owner_transactions(tenant_id);
create index if not exists owner_transactions_owner_idx  on owner_transactions(owner_id);
create index if not exists owner_transactions_date_idx   on owner_transactions(tenant_id, date);

-- ── 3. Tender-line detail (mirrors loan_disbursement_lines) ─────────
create table if not exists owner_transaction_lines (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  transaction_id   uuid not null references owner_transactions(id) on delete cascade,
  line_no          integer not null default 1,
  transaction_type text not null check (transaction_type in ('cash','pdc','online')),
  cheque_number    text,
  bank_id          uuid references banks(id) on delete set null,
  amount           numeric(15,2) not null,
  created_at       timestamptz not null default now()
);
create index if not exists owner_transaction_lines_txn_idx    on owner_transaction_lines(transaction_id);
create index if not exists owner_transaction_lines_tenant_idx on owner_transaction_lines(tenant_id);
create index if not exists owner_transaction_lines_bank_idx   on owner_transaction_lines(bank_id);

-- ── 4. GL sub-ledger tag (owner dimension on journal lines) ─────────
alter table tajir_journal_entry_lines
  add column if not exists owner_id uuid references owners(id);
create index if not exists tajir_journal_entry_lines_owner_idx
  on tajir_journal_entry_lines(owner_id);

-- ── 5. Row-level security (same JWT expression as 0025 / 0026) ──────
alter table owners                  enable row level security;
alter table owner_transactions      enable row level security;
alter table owner_transaction_lines enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'owners','owner_transactions','owner_transaction_lines'
  ] loop
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

-- ── 6. Serial allocator: add owner_withdrawal (OW) / owner_contribution (OC) ──
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

-- ── 7. Chart of accounts ────────────────────────────────────────────
-- Adds 3400 Owner's Drawings, and RESTORES 3300 Opening Balance Equity.
-- 3300 was introduced by 0022 but silently dropped by the seed redefinitions
-- in 0023/0026/0027, so tenants seeded after 0023 never received it and
-- `set-account-opening-balance.ts` (which resolves 'opening_balance_equity')
-- has been a no-op for them. The backfill at the end repairs those tenants.
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
    (p_tenant_id,'3200','Retained Earnings',          'equity',   '3000', false, false, null),
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

-- Backfill 3300 + 3400 for all existing tenants (ON CONFLICT leaves the rest untouched).
do $$
declare
  t record;
begin
  for t in select id from tenants loop
    perform seed_standard_coa(t.id);
  end loop;
end $$;
