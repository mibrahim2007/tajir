-- Split-tender detail lines for customer receipts and supplier payments.
-- Each line records how part of a receipt/payment was tendered: transaction
-- type (cash/pdc/online), an optional cheque number and bank, and an amount.
-- The parent row's amount/pkr_equivalent stays authoritative (= sum of lines).

create table if not exists ar_receipt_lines (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  receipt_id       uuid not null references ar_receipts(id) on delete cascade,
  line_no          integer not null default 1,
  transaction_type text not null check (transaction_type in ('cash','pdc','online')),
  cheque_number    text,
  bank_id          uuid references banks(id) on delete set null,
  amount           numeric(15,2) not null,
  created_at       timestamptz not null default now()
);
create index if not exists ar_receipt_lines_receipt_idx on ar_receipt_lines(receipt_id);
create index if not exists ar_receipt_lines_tenant_idx  on ar_receipt_lines(tenant_id);
create index if not exists ar_receipt_lines_bank_idx    on ar_receipt_lines(bank_id);

create table if not exists ap_payment_lines (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  payment_id       uuid not null references ap_payments(id) on delete cascade,
  line_no          integer not null default 1,
  transaction_type text not null check (transaction_type in ('cash','pdc','online')),
  cheque_number    text,
  bank_id          uuid references banks(id) on delete set null,
  amount           numeric(15,2) not null,
  created_at       timestamptz not null default now()
);
create index if not exists ap_payment_lines_payment_idx on ap_payment_lines(payment_id);
create index if not exists ap_payment_lines_tenant_idx   on ap_payment_lines(tenant_id);
create index if not exists ap_payment_lines_bank_idx     on ap_payment_lines(bank_id);

-- Tenant-isolation RLS, mirroring ar_receipts / ap_payments.
alter table ar_receipt_lines enable row level security;
alter table ap_payment_lines enable row level security;

create policy "ar_receipt_lines: tenant select" on ar_receipt_lines for select
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "ar_receipt_lines: tenant insert" on ar_receipt_lines for insert
  with check (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "ar_receipt_lines: tenant update" on ar_receipt_lines for update
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "ar_receipt_lines: tenant delete" on ar_receipt_lines for delete
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);

create policy "ap_payment_lines: tenant select" on ap_payment_lines for select
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "ap_payment_lines: tenant insert" on ap_payment_lines for insert
  with check (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "ap_payment_lines: tenant update" on ap_payment_lines for update
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
create policy "ap_payment_lines: tenant delete" on ap_payment_lines for delete
  using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
