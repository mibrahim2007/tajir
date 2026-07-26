-- ── Opening post-dated cheques ──────────────────────────────────────
-- Every row of `pdc_register` is derived from a document raised inside Tajir —
-- a receipt, a payment, a refund, a loan, an owner movement — and every
-- tender-line table has a NOT NULL foreign key to that parent. So a cheque
-- that already existed at go-live had nowhere to go: the only way to account
-- for it was a lump opening balance on 1112, which carries no cheque number,
-- no due date and no party, and can never be cleared or bounced. Migration
-- 0043 records a live tenant doing exactly that for 8,548,041.
--
-- This table is the missing parent: a cheque that belongs to no document. It
-- carries the same lifecycle columns as the seven tender-line tables, so once
-- it appears in the register every existing consumer — the register page, the
-- pending panel, settle-pdc, endorsement — works on it unchanged.

create table if not exists pdc_opening_cheques (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  -- Voucher-style serial (prefix OPC) so the register has something to show in
  -- its document column, and the GL entry has a reference.
  serial_number   text,
  -- The go-live / as-of date the cheque is being brought onto the books at.
  as_of_date      date not null,
  -- 'in'  = a cheque we hold, received from a party  → asset  1112
  -- 'out' = a cheque we have written and handed over → liability 2115
  direction       text not null check (direction in ('in','out')),
  -- Optional: the cheque can be recorded without naming a party, in which case
  -- a bounce reverses straight back to Opening Balance Equity.
  party_kind      text check (party_kind in ('customer','supplier','employee','owner')),
  party_id        uuid,
  -- Free-text fallback for a party that was never created in Tajir.
  party_label     text,
  -- Both mandatory here, unlike the tender-line tables where they are nullable
  -- for historical rows: there is no reason to load an opening cheque without
  -- the two facts that make it a cheque. Without a due date it never becomes
  -- overdue and sorts last forever (see 0041).
  cheque_number   text not null,
  cheque_due_date date not null,
  bank_id         uuid references banks(id) on delete set null,
  amount          numeric(15,2) not null check (amount > 0),
  pdc_status      text not null default 'pending'
    check (pdc_status in ('pending','cleared','bounced','endorsed')),
  settled_at      timestamptz,
  settled_bank_id uuid references banks(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists pdc_opening_cheques_tenant_idx on pdc_opening_cheques(tenant_id);
create index if not exists pdc_opening_cheques_pdc_idx on pdc_opening_cheques(tenant_id, pdc_status);

-- One cheque number can only be loaded once per side. Two rows for the same
-- physical cheque would double the 1112 balance and both could be settled.
create unique index if not exists pdc_opening_cheques_number_idx
  on pdc_opening_cheques(tenant_id, direction, cheque_number);

alter table pdc_opening_cheques enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'pdc_opening_cheques') then
    create policy "pdc_opening_cheques: tenant select" on pdc_opening_cheques for select
      using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
    create policy "pdc_opening_cheques: tenant insert" on pdc_opening_cheques for insert
      with check (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
    create policy "pdc_opening_cheques: tenant update" on pdc_opening_cheques for update
      using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
    create policy "pdc_opening_cheques: tenant delete" on pdc_opening_cheques for delete
      using (tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid);
  end if;
end $$;

-- ── Register: an eighth branch, restated in full ────────────────────
-- Restated rather than replaced for the reason given in 0042: the view has
-- drifted from this directory before, and `create or replace view` cannot add
-- a branch anyway without matching the existing column list exactly.
--
-- `document_id` is the cheque's own id — there is no parent document, and the
-- column is non-nullable in lib/pdc/sources.ts.
--
-- `counter_key` is the account a BOUNCE reverses into, which is not the
-- account the opening entry was posted against. The opening entry offsets
-- Opening Balance Equity (it is an opening balance like any other), but a
-- cheque that later fails means the party owes us again — so the counter is
-- their subledger, exactly as it is for a cheque taken on a receipt. Where no
-- party was named there is nothing to re-owe, so it reverses back to equity.
drop view if exists pdc_register;

create view pdc_register as
  select 'ar_receipt' as source, l.id as line_id, l.tenant_id, l.receipt_id as document_id,
         r.serial_number as doc_serial, r.date as doc_date, c.name as party_name,
         r.customer_id as party_id, 'customer' as party_kind,
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'in' as direction, 'accounts_receivable' as counter_key, l.pdc_status, l.settled_at
    from ar_receipt_lines l
    join ar_receipts r on r.id = l.receipt_id
    left join tajir_customers c on c.id = r.customer_id
   where l.transaction_type = 'pdc'

  union all
  select 'ap_payment', l.id, l.tenant_id, l.payment_id,
         p.serial_number, p.date, s.name,
         p.supplier_id, 'supplier',
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'out', 'accounts_payable', l.pdc_status, l.settled_at
    from ap_payment_lines l
    join ap_payments p on p.id = l.payment_id
    left join suppliers s on s.id = p.supplier_id
   where l.transaction_type = 'pdc'
     and l.endorsed_from_line_id is null

  union all
  select 'customer_refund', l.id, l.tenant_id, l.refund_id,
         r.serial_number, r.date, c.name,
         r.customer_id, 'customer',
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'out', 'accounts_receivable', l.pdc_status, l.settled_at
    from customer_refund_lines l
    join customer_refunds r on r.id = l.refund_id
    left join tajir_customers c on c.id = r.customer_id
   where l.transaction_type = 'pdc'

  union all
  select 'supplier_refund', l.id, l.tenant_id, l.refund_id,
         r.serial_number, r.date, s.name,
         r.supplier_id, 'supplier',
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'in', 'accounts_payable', l.pdc_status, l.settled_at
    from supplier_refund_lines l
    join supplier_refunds r on r.id = l.refund_id
    left join suppliers s on s.id = r.supplier_id
   where l.transaction_type = 'pdc'

  union all
  select 'employee_loan', l.id, l.tenant_id, l.loan_id,
         el.serial_number, el.disbursement_date, e.name,
         el.employee_id, 'employee',
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'out', 'employee_loans_receivable', l.pdc_status, l.settled_at
    from loan_disbursement_lines l
    join employee_loans el on el.id = l.loan_id
    left join employees e on e.id = el.employee_id
   where l.transaction_type = 'pdc'
     and l.endorsed_from_line_id is null

  union all
  select 'loan_repayment', l.id, l.tenant_id, l.repayment_id,
         lr.serial_number, lr.date, e.name,
         lr.employee_id, 'employee',
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'in', 'employee_loans_receivable', l.pdc_status, l.settled_at
    from loan_repayment_lines l
    join loan_repayments lr on lr.id = l.repayment_id
    left join employees e on e.id = lr.employee_id
   where l.transaction_type = 'pdc'

  union all
  select 'owner_transaction', l.id, l.tenant_id, l.transaction_id,
         ot.serial_number, ot.date, o.name,
         ot.owner_id, 'owner',
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         case when ot.txn_type = 'withdrawal' then 'out' else 'in' end,
         case when ot.txn_type = 'withdrawal' then 'owners_drawings' else 'owners_capital' end,
         l.pdc_status, l.settled_at
    from owner_transaction_lines l
    join owner_transactions ot on ot.id = l.transaction_id
    left join owners o on o.id = ot.owner_id
   where l.transaction_type = 'pdc'

  union all
  select 'pdc_opening', l.id, l.tenant_id, l.id,
         l.serial_number, l.as_of_date,
         coalesce(c.name, s.name, e.name, o.name, l.party_label),
         l.party_id, l.party_kind,
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         l.direction,
         case l.party_kind
           when 'customer' then 'accounts_receivable'
           when 'supplier' then 'accounts_payable'
           when 'employee' then 'employee_loans_receivable'
           when 'owner'    then case when l.direction = 'out' then 'owners_drawings' else 'owners_capital' end
           else 'opening_balance_equity'
         end,
         l.pdc_status, l.settled_at
    from pdc_opening_cheques l
    left join tajir_customers c on c.id = l.party_id and l.party_kind = 'customer'
    left join suppliers       s on s.id = l.party_id and l.party_kind = 'supplier'
    left join employees       e on e.id = l.party_id and l.party_kind = 'employee'
    left join owners          o on o.id = l.party_id and l.party_kind = 'owner';
