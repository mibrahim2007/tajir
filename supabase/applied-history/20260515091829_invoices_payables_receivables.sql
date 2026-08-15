
-- ============================================================
-- Invoices / Payables / Receivables Schema
-- ============================================================

create type invoice_type     as enum ('RECEIVABLE', 'PAYABLE');
create type invoice_status   as enum ('DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID');
create type payment_method   as enum ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'CREDIT_CARD', 'OTHER');

-- Customers (AR counterparties)
create table customers (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  address     text,
  currency    text not null default 'USD',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index customers_org_idx on customers(org_id);
alter table customers enable row level security;
create policy "Members can view customers" on customers
  for select using (is_org_member(org_id));
create policy "Accountants+ can manage customers" on customers
  for all using (is_org_member_with_role(org_id, ARRAY['OWNER','ADMIN','ACCOUNTANT']::user_role[]));

-- Vendors (AP counterparties)
create table vendors (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  address     text,
  currency    text not null default 'USD',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index vendors_org_idx on vendors(org_id);
alter table vendors enable row level security;
create policy "Members can view vendors" on vendors
  for select using (is_org_member(org_id));
create policy "Accountants+ can manage vendors" on vendors
  for all using (is_org_member_with_role(org_id, ARRAY['OWNER','ADMIN','ACCOUNTANT']::user_role[]));

-- Invoices (both AR and AP)
create table invoices (
  id               uuid primary key default uuid_generate_v4(),
  org_id           uuid not null references organizations(id) on delete cascade,
  type             invoice_type not null,
  number           text not null,
  customer_id      uuid references customers(id),
  vendor_id        uuid references vendors(id),
  issue_date       date not null,
  due_date         date not null,
  status           invoice_status not null default 'DRAFT',
  subtotal         numeric(19,4) not null default 0,
  tax_rate         numeric(5,4)  not null default 0,
  tax_amount       numeric(19,4) not null default 0,
  total            numeric(19,4) not null default 0,
  amount_paid      numeric(19,4) not null default 0,
  notes            text,
  journal_entry_id uuid references journal_entries(id),
  created_by       uuid not null references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(org_id, number)
);
create index invoices_org_type_idx  on invoices(org_id, type);
create index invoices_org_status_idx on invoices(org_id, status);
create index invoices_due_date_idx  on invoices(org_id, due_date);
alter table invoices enable row level security;
create policy "Members can view invoices" on invoices
  for select using (is_org_member(org_id));
create policy "Accountants+ can manage invoices" on invoices
  for all using (is_org_member_with_role(org_id, ARRAY['OWNER','ADMIN','ACCOUNTANT']::user_role[]));

-- Invoice line items
create table invoice_lines (
  id           uuid primary key default uuid_generate_v4(),
  invoice_id   uuid not null references invoices(id) on delete cascade,
  description  text not null,
  quantity     numeric(10,4) not null default 1,
  unit_price   numeric(19,4) not null default 0,
  amount       numeric(19,4) not null default 0,
  account_id   uuid references accounts(id)
);
alter table invoice_lines enable row level security;
create policy "Members can view invoice lines" on invoice_lines
  for select using (
    exists (select 1 from invoices i where i.id = invoice_lines.invoice_id and is_org_member(i.org_id))
  );
create policy "Accountants+ can manage invoice lines" on invoice_lines
  for all using (
    exists (select 1 from invoices i where i.id = invoice_lines.invoice_id
      and is_org_member_with_role(i.org_id, ARRAY['OWNER','ADMIN','ACCOUNTANT']::user_role[]))
  );

-- Payments
create table payments (
  id               uuid primary key default uuid_generate_v4(),
  org_id           uuid not null references organizations(id) on delete cascade,
  invoice_id       uuid not null references invoices(id) on delete cascade,
  payment_date     date not null,
  amount           numeric(19,4) not null,
  payment_method   payment_method not null default 'BANK_TRANSFER',
  reference        text,
  notes            text,
  journal_entry_id uuid references journal_entries(id),
  created_at       timestamptz not null default now()
);
create index payments_invoice_idx on payments(invoice_id);
alter table payments enable row level security;
create policy "Members can view payments" on payments
  for select using (is_org_member(org_id));
create policy "Accountants+ can manage payments" on payments
  for all using (is_org_member_with_role(org_id, ARRAY['OWNER','ADMIN','ACCOUNTANT']::user_role[]));

-- Auto-update timestamps
create trigger customers_updated_at before update on customers
  for each row execute function update_updated_at();
create trigger vendors_updated_at before update on vendors
  for each row execute function update_updated_at();
create trigger invoices_updated_at before update on invoices
  for each row execute function update_updated_at();

-- View: AR aging buckets
create or replace view ar_aging as
select
  i.org_id,
  i.id,
  i.number,
  c.name as customer_name,
  i.issue_date,
  i.due_date,
  i.total,
  i.amount_paid,
  (i.total - i.amount_paid) as balance_due,
  greatest(0, current_date - i.due_date) as days_overdue,
  case
    when current_date <= i.due_date then 'current'
    when current_date - i.due_date between 1  and 30  then '1_30'
    when current_date - i.due_date between 31 and 60  then '31_60'
    when current_date - i.due_date between 61 and 90  then '61_90'
    else '90_plus'
  end as aging_bucket
from invoices i
join customers c on c.id = i.customer_id
where i.type = 'RECEIVABLE'
  and i.status not in ('PAID', 'VOID', 'DRAFT');

-- View: AP aging buckets
create or replace view ap_aging as
select
  i.org_id,
  i.id,
  i.number,
  v.name as vendor_name,
  i.issue_date,
  i.due_date,
  i.total,
  i.amount_paid,
  (i.total - i.amount_paid) as balance_due,
  greatest(0, current_date - i.due_date) as days_overdue,
  case
    when current_date <= i.due_date then 'current'
    when current_date - i.due_date between 1  and 30  then '1_30'
    when current_date - i.due_date between 31 and 60  then '31_60'
    when current_date - i.due_date between 61 and 90  then '61_90'
    else '90_plus'
  end as aging_bucket
from invoices i
join vendors v on v.id = i.vendor_id
where i.type = 'PAYABLE'
  and i.status not in ('PAID', 'VOID', 'DRAFT');
