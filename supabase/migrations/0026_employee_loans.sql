-- ── Employee Loans module (Phase 1 MVP) ─────────────────────────────
-- Interest-free staff loans/advances disbursed as money-out and recovered
-- in installments (or ad-hoc). Each loan is its own record with an optional
-- equal-installment schedule; repayments attach to the EMPLOYEE and roll up
-- to one per-employee running balance, so a second loan taken while a first
-- is still outstanding is handled naturally (outstanding = Σ disbursed − Σ repaid).
--
-- GL (resolves accounts by system_key, mirroring receipts/payments):
--   Disburse:  DR Employee Loans & Advances (1135)  / CR Cash/Bank/PDC (tender legs)
--   Repay:     DR Cash/Bank/PDC (tender legs)        / CR Employee Loans & Advances (1135)

-- ── 1. Employee master ──────────────────────────────────────────────
create table if not exists employees (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  name           text not null,
  employee_code  text,
  phone          text,
  cnic           text,
  designation    text,
  monthly_salary numeric(15,2) not null default 0,   -- payroll hook (Phase 3)
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists employees_tenant_idx on employees(tenant_id);

-- ── 2. Loans (one disbursement = one loan) ──────────────────────────
create table if not exists employee_loans (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  serial_number      text,
  employee_id        uuid not null references employees(id) on delete cascade,
  principal          numeric(15,2) not null,
  currency_code      char(3) not null default 'PKR',
  exchange_rate      numeric(10,4) not null default 1,
  pkr_equivalent     numeric(15,2) not null,
  disbursement_date  date not null,
  installment_count  integer,                          -- null ⇒ ad-hoc repayment only
  installment_amount numeric(15,2),
  first_due_date     date,
  frequency          text not null default 'monthly',
  status             text not null default 'active'
                       check (status in ('active','closed','void')),
  notes              text,
  created_at         timestamptz not null default now()
);
create index if not exists employee_loans_tenant_idx   on employee_loans(tenant_id);
create index if not exists employee_loans_employee_idx on employee_loans(employee_id);

-- ── 3. Amortization schedule (expected installments) ────────────────
-- Pure "expected" rows; settlement status is COMPUTED from repayments,
-- never stored — so early payoff / extra loans stay consistent.
create table if not exists loan_installments (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  loan_id        uuid not null references employee_loans(id) on delete cascade,
  installment_no integer not null,
  due_date       date not null,
  amount         numeric(15,2) not null,
  created_at     timestamptz not null default now(),
  unique (loan_id, installment_no)
);
create index if not exists loan_installments_tenant_idx on loan_installments(tenant_id);
create index if not exists loan_installments_loan_idx   on loan_installments(loan_id);

-- ── 4. Repayments (money in) ────────────────────────────────────────
-- loan_id nullable ⇒ a general repayment; allocation across the employee's
-- loans is a display concern (FIFO, Phase 2) and never affects GL/outstanding.
create table if not exists loan_repayments (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  serial_number       text,
  employee_id         uuid not null references employees(id) on delete cascade,
  loan_id             uuid references employee_loans(id) on delete set null,
  amount              numeric(15,2) not null,
  currency_code       char(3) not null default 'PKR',
  exchange_rate       numeric(10,4) not null default 1,
  pkr_equivalent      numeric(15,2) not null,
  payment_method_note text,
  date                date not null,
  created_at          timestamptz not null default now()
);
create index if not exists loan_repayments_tenant_idx   on loan_repayments(tenant_id);
create index if not exists loan_repayments_employee_idx on loan_repayments(employee_id);
create index if not exists loan_repayments_loan_idx     on loan_repayments(loan_id);

-- ── 5. Tender-line detail (mirrors ar_receipt_lines / ap_payment_lines) ──
create table if not exists loan_disbursement_lines (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  loan_id          uuid not null references employee_loans(id) on delete cascade,
  line_no          integer not null default 1,
  transaction_type text not null check (transaction_type in ('cash','pdc','online')),
  cheque_number    text,
  bank_id          uuid references banks(id) on delete set null,
  amount           numeric(15,2) not null,
  created_at       timestamptz not null default now()
);
create index if not exists loan_disbursement_lines_loan_idx   on loan_disbursement_lines(loan_id);
create index if not exists loan_disbursement_lines_tenant_idx on loan_disbursement_lines(tenant_id);
create index if not exists loan_disbursement_lines_bank_idx   on loan_disbursement_lines(bank_id);

create table if not exists loan_repayment_lines (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  repayment_id     uuid not null references loan_repayments(id) on delete cascade,
  line_no          integer not null default 1,
  transaction_type text not null check (transaction_type in ('cash','pdc','online')),
  cheque_number    text,
  bank_id          uuid references banks(id) on delete set null,
  amount           numeric(15,2) not null,
  created_at       timestamptz not null default now()
);
create index if not exists loan_repayment_lines_repayment_idx on loan_repayment_lines(repayment_id);
create index if not exists loan_repayment_lines_tenant_idx    on loan_repayment_lines(tenant_id);
create index if not exists loan_repayment_lines_bank_idx      on loan_repayment_lines(bank_id);

-- ── 6. GL sub-ledger tag (optional employee dimension on journal lines) ──
alter table tajir_journal_entry_lines
  add column if not exists employee_id uuid references employees(id);

-- ── 7. Row-level security (tenant isolation, same JWT expression as 0025) ──
alter table employees               enable row level security;
alter table employee_loans          enable row level security;
alter table loan_installments       enable row level security;
alter table loan_repayments         enable row level security;
alter table loan_disbursement_lines enable row level security;
alter table loan_repayment_lines    enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'employees','employee_loans','loan_installments',
    'loan_repayments','loan_disbursement_lines','loan_repayment_lines'
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

-- ── 8. Serial allocator: add employee_loan (LN) and loan_repayment (LR) ──
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
    when 'purchase_order'  then 'PO'
    when 'sale_invoice'    then 'SI'
    when 'purchase_return' then 'PR'
    when 'sale_return'     then 'SR'
    when 'ar_receipt'      then 'RCP'
    when 'ap_payment'      then 'PAY'
    when 'customer_refund' then 'REF'
    when 'supplier_refund' then 'RCV'
    when 'employee_loan'   then 'LN'
    when 'loan_repayment'  then 'LR'
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

-- ── 9. Chart of accounts: seed 1135 Employee Loans & Advances ────────
-- Redefine the standard CoA seed so new tenants get 1135, then backfill
-- existing tenants (ON CONFLICT leaves already-seeded tenants untouched).
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
    (p_tenant_id,'6100','Salaries & Wages',           'expense',  '6000', false, false, null),
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

-- Backfill 1135 for all existing tenants.
do $$
declare
  t record;
begin
  for t in select id from tenants loop
    perform seed_standard_coa(t.id);
  end loop;
end $$;
