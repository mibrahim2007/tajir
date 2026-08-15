create table if not exists pdc_opening_cheques (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  serial_number   text,
  as_of_date      date not null,
  direction       text not null check (direction in ('in','out')),
  party_kind      text check (party_kind in ('customer','supplier','employee','owner')),
  party_id        uuid,
  party_label     text,
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