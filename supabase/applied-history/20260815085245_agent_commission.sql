-- ── Agents & Commission module ──────────────────────────────────────
-- A tenant deals through brokers/agents (arhti) who bring both sides of the
-- trade. WE OWE THEM commission, so an agent is a PAYABLE party — a distinct
-- fourth party type alongside customer / supplier / employee / owner.
--
-- Commission basis (`commission_type`):
--   percentage → base_amount * rate / 100      (rate is a percent)
--   per_unit   → base_quantity * rate          (rate is PKR per unit)
--   flat       → rate                          (a fixed PKR amount per invoice)
--   none       → no commission accrues on that side
--
-- GL, both sides (purchase commission is expensed, NOT capitalised into stock):
--   Accrual at invoice:  DR 6500 Commission Expense
--                          CR 2150 Agent Commission Payable   (agent_id dim)
--   Payout:              DR 2150 Agent Commission Payable     (agent_id dim)
--                          CR Cash / Bank / PDC-issued        (tender legs)

-- ── 1. Agent master ─────────────────────────────────────────────────
create table if not exists agents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  agent_code    text,
  cnic          text,
  phone         text,
  email         text,
  city          text,
  address       text,

  -- Commission earned on SALES introduced by this agent.
  sale_commission_type text not null default 'percentage'
    check (sale_commission_type in ('percentage','per_unit','flat','none')),
  sale_commission_rate numeric(15,4) not null default 0
    check (sale_commission_rate >= 0),

  -- Commission earned on PURCHASES arranged by this agent. Deliberately
  -- separate from the sale side: the same broker is commonly paid, say, 1% on
  -- sales but a per-bag rate on purchases.
  purchase_commission_type text not null default 'percentage'
    check (purchase_commission_type in ('percentage','per_unit','flat','none')),
  purchase_commission_rate numeric(15,4) not null default 0
    check (purchase_commission_rate >= 0),

  -- Commission already owed to the agent when they were enrolled. Held on the
  -- master record and used as the opening line of their ledger — NOT posted to
  -- the GL, exactly as customer and supplier opening balances behave today.
  opening_balance                numeric(15,2) not null default 0,
  opening_balance_currency       char(3)       not null default 'PKR',
  opening_balance_pkr_equivalent numeric(15,2) not null default 0,

  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists agents_tenant_idx on agents(tenant_id);
-- A code is optional, but where given it must identify one agent in the tenant.
create unique index if not exists agents_tenant_code_uniq
  on agents(tenant_id, agent_code) where agent_code is not null;

-- ── 2. Accrued commission, one row per (document, agent) ────────────
-- The row is the audit trail behind the GL accrual: it records the basis the
-- commission was computed on and the rate in force AT THE TIME, so later
-- edits to the agent's default rate never silently restate history.
--
-- `amount` is signed. Today only invoices accrue, so it is always positive; the
-- sign exists so a future return clawback can be booked as a negative row
-- without a schema change. Returns do NOT claw back commission yet.
create table if not exists agent_commissions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  agent_id        uuid not null references agents(id) on delete restrict,
  source_type     text not null check (source_type in ('sale_invoice','purchase_invoice')),
  source_id       uuid not null,
  document_serial text,
  party_name      text,
  base_amount     numeric(15,2) not null default 0,
  base_quantity   numeric(15,3) not null default 0,
  commission_type text not null check (commission_type in ('percentage','per_unit','flat')),
  commission_rate numeric(15,4) not null default 0,
  amount          numeric(15,2) not null,
  date            date not null,
  notes           text,
  created_at      timestamptz not null default now(),
  -- One accrual per source document: editing an invoice upserts onto this row
  -- rather than stacking a second accrual on top of the first.
  unique (tenant_id, source_type, source_id)
);
create index if not exists agent_commissions_tenant_idx on agent_commissions(tenant_id);
create index if not exists agent_commissions_agent_idx  on agent_commissions(agent_id);
create index if not exists agent_commissions_date_idx   on agent_commissions(tenant_id, date);

-- ── 3. Payouts to the agent (settles the payable) ───────────────────
create table if not exists agent_payments (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  serial_number  text,
  agent_id       uuid not null references agents(id) on delete restrict,
  amount         numeric(15,2) not null check (amount > 0),
  currency_code  char(3) not null default 'PKR',
  exchange_rate  numeric(10,4) not null default 1,
  pkr_equivalent numeric(15,2) not null,
  date           date not null,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists agent_payments_tenant_idx on agent_payments(tenant_id);
create index if not exists agent_payments_agent_idx  on agent_payments(agent_id);
create index if not exists agent_payments_date_idx   on agent_payments(tenant_id, date);

-- Tender-line detail (mirrors owner_transaction_lines / loan_repayment_lines).
create table if not exists agent_payment_lines (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  payment_id       uuid not null references agent_payments(id) on delete cascade,
  line_no          integer not null default 1,
  transaction_type text not null check (transaction_type in ('cash','pdc','online')),
  cheque_number    text,
  cheque_due_date  date,
  bank_id          uuid references banks(id) on delete set null,
  amount           numeric(15,2) not null,
  created_at       timestamptz not null default now()
);
create index if not exists agent_payment_lines_payment_idx on agent_payment_lines(payment_id);
create index if not exists agent_payment_lines_tenant_idx  on agent_payment_lines(tenant_id);
create index if not exists agent_payment_lines_bank_idx    on agent_payment_lines(bank_id);

-- ── 4. GL sub-ledger tag (agent dimension on journal lines) ─────────
alter table tajir_journal_entry_lines
  add column if not exists agent_id uuid references agents(id);
create index if not exists tajir_journal_entry_lines_agent_idx
  on tajir_journal_entry_lines(agent_id);

-- ── 5. Agent introducing each trade ─────────────────────────────────
-- Stored on every line row of the invoice (like serial_number), so an invoice's
-- agent is readable from any one of its rows.
alter table sales_orders    add column if not exists agent_id uuid references agents(id);
alter table purchase_orders add column if not exists agent_id uuid references agents(id);
create index if not exists sales_orders_agent_idx    on sales_orders(agent_id);
create index if not exists purchase_orders_agent_idx on purchase_orders(agent_id);

-- ── 6. Row-level security ───────────────────────────────────────────
alter table agents              enable row level security;
alter table agent_commissions   enable row level security;
alter table agent_payments      enable row level security;
alter table agent_payment_lines enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'agents','agent_commissions','agent_payments','agent_payment_lines'
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

-- ── 7. Serial allocator: add agent_payment (AGP) ────────────────────
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
    when 'agent_payment'      then 'AGP'
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

-- ── 8. Chart of accounts ────────────────────────────────────────────
-- Adds 2150 Agent Commission Payable and gives 6500 Commission Expense the
-- system_key the posting engine resolves it by (it resolves accounts by
-- system_key ONLY, so 6500 was unreachable from posting code until now).
--
-- This definition is the UNION of every prior seed, reconciled against the
-- function actually DEPLOYED. Each migration that touches this function
-- redefines it wholesale from its own copy, so the deployed version had lost
-- 1135, 1170, 3300 and 3400 along with the retained_earnings and salaries_wages
-- keys that earlier migrations added. Existing tenants kept those rows because
-- each of those migrations backfilled them separately — but every tenant
-- created since has been seeded WITHOUT them. That is a live bug: a new tenant
-- gets no Freight Clearing account, so their first sale invoice carrying a
-- service line fails to post to the GL.
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
    (p_tenant_id,'1112','Post-Dated Cheques Received','asset',    '1100', false, true,  'post_dated_cheques'),
    (p_tenant_id,'1120','Cash at Bank',               'asset',    '1100', false, true,  'cash_at_bank'),
    (p_tenant_id,'1130','Accounts Receivable',        'asset',    '1100', false, true,  'accounts_receivable'),
    (p_tenant_id,'1135','Employee Loans & Advances',  'asset',    '1100', false, true,  'employee_loans_receivable'),
    (p_tenant_id,'1140','Stock in Trade',             'asset',    '1100', false, true,  'inventory'),
    (p_tenant_id,'1150','Advances & Deposits',        'asset',    '1100', false, false, null),
    (p_tenant_id,'1160','Prepaid Expenses',           'asset',    '1100', false, false, null),
    -- Control account for the freight pass-through on service sale lines; the
    -- sale-invoice posting path resolves it by system_key and fails without it.
    (p_tenant_id,'1170','Freight Clearing',           'asset',    '1100', false, true,  'freight_clearing'),
    (p_tenant_id,'1200','Non-Current Assets',         'asset',    '1000', true,  false, null),
    (p_tenant_id,'1210','Property, Plant & Equipment','asset',    '1200', false, false, null),
    (p_tenant_id,'1220','Accumulated Depreciation',   'asset',    '1200', false, false, null),
    -- ── LIABILITIES ─────────────────────────────────────────
    (p_tenant_id,'2000','LIABILITIES',                'liability',null,   true,  true,  null),
    (p_tenant_id,'2100','Current Liabilities',        'liability','2000', true,  true,  null),
    (p_tenant_id,'2110','Accounts Payable',           'liability','2100', false, true,  'accounts_payable'),
    (p_tenant_id,'2115','Post-Dated Cheques Issued',  'liability','2100', false, true,  'post_dated_cheques_payable'),
    (p_tenant_id,'2120','Short-term Borrowings',      'liability','2100', false, false, null),
    (p_tenant_id,'2130','Accrued Expenses',           'liability','2100', false, false, null),
    (p_tenant_id,'2140','Sales Tax Payable',          'liability','2100', false, false, null),
    (p_tenant_id,'2150','Agent Commission Payable',   'liability','2100', false, true,  'agent_commission_payable'),
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
    (p_tenant_id,'6500','Commission Expense',         'expense',  '6000', false, true,  'commission_expense'),
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

-- Insert the missing rows for every existing tenant. ON CONFLICT leaves rows
-- they already have untouched, so this only ever adds.
do $$
declare
  t record;
begin
  for t in select id from tenants loop
    perform seed_standard_coa(t.id);
  end loop;
end $$;

-- Existing tenants already HAVE 6500 but with system_key null — set it.
-- Guarded: skip any tenant that has somehow already assigned the key elsewhere.
update chart_of_accounts c
   set system_key = 'commission_expense'
 where c.code = '6500'
   and c.system_key is null
   and not exists (
     select 1 from chart_of_accounts o
      where o.tenant_id = c.tenant_id
        and o.system_key = 'commission_expense'
   );

update chart_of_accounts c
   set system_key = 'salaries_wages'
 where c.code = '6100'
   and c.system_key is null
   and not exists (
     select 1 from chart_of_accounts o
      where o.tenant_id = c.tenant_id and o.system_key = 'salaries_wages'
   );

update chart_of_accounts c
   set system_key = 'retained_earnings'
 where c.code = '3200'
   and c.system_key is null
   and not exists (
     select 1 from chart_of_accounts o
      where o.tenant_id = c.tenant_id and o.system_key = 'retained_earnings'
   );