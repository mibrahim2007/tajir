-- ── Cheque endorsement ──────────────────────────────────────────────
-- A post-dated cheque received from a customer can be handed straight on to a
-- supplier (or to an employee as loan disbursement) instead of being banked.
-- The physical cheque never touches our account: it leaves 1112 the moment we
-- endorse it over, which is the same GL movement a payment already makes
--     DR Accounts Payable / CR 1112
-- so no new accounting is needed. What was missing is consuming the source
-- cheque, so it cannot ALSO be cleared into our bank later — that would
-- release the same 1112 amount twice.
--
-- An endorsed outgoing line is therefore NOT a new cheque. It is the disposal
-- of an existing one, so it is excluded from the register (see part 3) while
-- the source cheque stays visible with status 'endorsed'.

-- ── 1. The new terminal status ──────────────────────────────────────
-- 'endorsed' joins cleared/bounced as a way a pending cheque leaves the
-- pending list. It is deliberately allowed on all seven tables: any received
-- cheque can in principle be passed on, even if only two forms offer it today.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'ar_receipt_lines','ap_payment_lines','customer_refund_lines','supplier_refund_lines',
    'loan_disbursement_lines','loan_repayment_lines','owner_transaction_lines'
  ] loop
    execute format($f$
      alter table %1$s drop constraint if exists %1$s_pdc_status_check;
      alter table %1$s add constraint %1$s_pdc_status_check
        check (pdc_status in ('pending','cleared','bounced','endorsed'));
    $f$, tbl);
  end loop;
end $$;

-- ── 2. The link back to the cheque being handed on ──────────────────
-- Only the two outgoing forms that offer endorsement carry the link. The
-- source is (table, line id) rather than a foreign key because the cheque can
-- come from any of the seven tender-line tables — the same reason pdc_register
-- exists at all. No FK, so the pair is validated by the server action.
alter table ap_payment_lines
  add column if not exists endorsed_from_source  text,
  add column if not exists endorsed_from_line_id uuid;

alter table loan_disbursement_lines
  add column if not exists endorsed_from_source  text,
  add column if not exists endorsed_from_line_id uuid;

-- One physical cheque can only be handed on once. A partial unique index is
-- the backstop behind the server-side pending check: without it, two
-- concurrent payments could both endorse the same cheque.
create unique index if not exists ap_payment_lines_endorsed_once_idx
  on ap_payment_lines(endorsed_from_source, endorsed_from_line_id)
  where endorsed_from_line_id is not null;

create unique index if not exists loan_disbursement_lines_endorsed_once_idx
  on loan_disbursement_lines(endorsed_from_source, endorsed_from_line_id)
  where endorsed_from_line_id is not null;

-- ── 3. Register: exclude endorsed-out lines, and restate in full ────
-- Dropped rather than replaced because the live view already carries party_id
-- and party_kind while no migration ever added them — the view was changed
-- out-of-band, so a database rebuilt from this directory would have produced a
-- narrower view than lib/pdc/sources.ts expects, silently dropping the party
-- dimension when a bounce posts. Restating the whole view closes that drift.
--
-- The two changed branches are ap_payment and employee_loan: a line with
-- endorsed_from_line_id set is a cheque leaving, not a cheque created, so it
-- must never appear as its own pending row.
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
   where l.transaction_type = 'pdc';
