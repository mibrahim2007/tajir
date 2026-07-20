-- ── Post-dated cheque lifecycle ─────────────────────────────────────
-- Until now a PDC was write-once: the tender line posted to 1112 Post-Dated
-- Cheques and nothing ever moved it out again, so 1112 grew forever as the
-- gross sum of every cheque ever tendered and there was no way to tell which
-- cheques were still outstanding.
--
-- Each PDC tender line now carries a due date and a status:
--   pending  — with the bank / not yet presented (the default)
--   cleared  — funds moved; the amount leaves 1112 for the real cash account
--   bounced  — the cheque failed; the underlying receivable/payable comes back
--
-- The GL for those two events is posted by the application (clear-pdc.ts /
-- bounce-pdc.ts) because the counter-account depends on the document type.

-- ── 1. The two tender-line tables that were applied out-of-band ─────
-- customer_refund_lines and supplier_refund_lines exist in the live database
-- but never had a migration, so a fresh environment could not be rebuilt from
-- this directory. Created here (idempotently) to close that drift.
create table if not exists customer_refund_lines (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  refund_id        uuid not null references customer_refunds(id) on delete cascade,
  line_no          integer not null default 1,
  transaction_type text not null check (transaction_type in ('cash','pdc','online')),
  cheque_number    text,
  bank_id          uuid references banks(id) on delete set null,
  amount           numeric(15,2) not null,
  created_at       timestamptz not null default now()
);
create index if not exists customer_refund_lines_refund_idx on customer_refund_lines(refund_id);
create index if not exists customer_refund_lines_tenant_idx on customer_refund_lines(tenant_id);

create table if not exists supplier_refund_lines (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  refund_id        uuid not null references supplier_refunds(id) on delete cascade,
  line_no          integer not null default 1,
  transaction_type text not null check (transaction_type in ('cash','pdc','online')),
  cheque_number    text,
  bank_id          uuid references banks(id) on delete set null,
  amount           numeric(15,2) not null,
  created_at       timestamptz not null default now()
);
create index if not exists supplier_refund_lines_refund_idx on supplier_refund_lines(refund_id);
create index if not exists supplier_refund_lines_tenant_idx on supplier_refund_lines(tenant_id);

do $$
declare tbl text;
begin
  foreach tbl in array array['customer_refund_lines','supplier_refund_lines'] loop
    execute format('alter table %I enable row level security', tbl);
    if not exists (select 1 from pg_policies where tablename = tbl) then
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
    end if;
  end loop;
end $$;

-- ── 2. Lifecycle columns on every tender-line table ─────────────────
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'ar_receipt_lines','ap_payment_lines','customer_refund_lines','supplier_refund_lines',
    'loan_disbursement_lines','loan_repayment_lines','owner_transaction_lines'
  ] loop
    execute format($f$
      alter table %1$s
        add column if not exists cheque_due_date date,
        add column if not exists pdc_status text not null default 'pending'
          check (pdc_status in ('pending','cleared','bounced')),
        add column if not exists settled_at timestamptz,
        add column if not exists settled_bank_id uuid references banks(id) on delete set null;
      create index if not exists %1$s_pdc_idx on %1$s(tenant_id, transaction_type, pdc_status);
    $f$, tbl);
  end loop;
end $$;

-- ── 3. One register across all seven sources ───────────────────────
-- Every consumer (the entry-form panel, the register page, the clearing
-- action) reads this instead of unioning seven tables by hand.
--
-- `direction` is 'in' when the cheque brings money in (1112 was DEBITED on the
-- original posting) and 'out' when it takes money out (1112 was CREDITED).
-- Clearing swaps 1112 for the bank in that same direction.
create or replace view pdc_register as
  select 'ar_receipt' as source, l.id as line_id, l.tenant_id, l.receipt_id as document_id,
         r.serial_number as doc_serial, r.date as doc_date, c.name as party_name,
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'in' as direction, 'accounts_receivable' as counter_key, l.pdc_status, l.settled_at
    from ar_receipt_lines l
    join ar_receipts r on r.id = l.receipt_id
    left join tajir_customers c on c.id = r.customer_id
   where l.transaction_type = 'pdc'

  union all
  select 'ap_payment', l.id, l.tenant_id, l.payment_id,
         p.serial_number, p.date, s.name, l.cheque_number, l.cheque_due_date,
         l.bank_id, l.amount, 'out', 'accounts_payable', l.pdc_status, l.settled_at
    from ap_payment_lines l
    join ap_payments p on p.id = l.payment_id
    left join suppliers s on s.id = p.supplier_id
   where l.transaction_type = 'pdc'

  union all
  select 'customer_refund', l.id, l.tenant_id, l.refund_id,
         r.serial_number, r.date, c.name, l.cheque_number, l.cheque_due_date,
         l.bank_id, l.amount, 'out', 'accounts_receivable', l.pdc_status, l.settled_at
    from customer_refund_lines l
    join customer_refunds r on r.id = l.refund_id
    left join tajir_customers c on c.id = r.customer_id
   where l.transaction_type = 'pdc'

  union all
  select 'supplier_refund', l.id, l.tenant_id, l.refund_id,
         r.serial_number, r.date, s.name, l.cheque_number, l.cheque_due_date,
         l.bank_id, l.amount, 'in', 'accounts_payable', l.pdc_status, l.settled_at
    from supplier_refund_lines l
    join supplier_refunds r on r.id = l.refund_id
    left join suppliers s on s.id = r.supplier_id
   where l.transaction_type = 'pdc'

  union all
  select 'employee_loan', l.id, l.tenant_id, l.loan_id,
         el.serial_number, el.disbursement_date, e.name, l.cheque_number, l.cheque_due_date,
         l.bank_id, l.amount, 'out', 'employee_loans_receivable', l.pdc_status, l.settled_at
    from loan_disbursement_lines l
    join employee_loans el on el.id = l.loan_id
    left join employees e on e.id = el.employee_id
   where l.transaction_type = 'pdc'

  union all
  select 'loan_repayment', l.id, l.tenant_id, l.repayment_id,
         lr.serial_number, lr.date, e.name, l.cheque_number, l.cheque_due_date,
         l.bank_id, l.amount, 'in', 'employee_loans_receivable', l.pdc_status, l.settled_at
    from loan_repayment_lines l
    join loan_repayments lr on lr.id = l.repayment_id
    left join employees e on e.id = lr.employee_id
   where l.transaction_type = 'pdc'

  union all
  select 'owner_transaction', l.id, l.tenant_id, l.transaction_id,
         ot.serial_number, ot.date, o.name, l.cheque_number, l.cheque_due_date,
         l.bank_id, l.amount,
         case when ot.txn_type = 'withdrawal' then 'out' else 'in' end,
         case when ot.txn_type = 'withdrawal' then 'owners_drawings' else 'owners_capital' end,
         l.pdc_status, l.settled_at
    from owner_transaction_lines l
    join owner_transactions ot on ot.id = l.transaction_id
    left join owners o on o.id = ot.owner_id
   where l.transaction_type = 'pdc';
