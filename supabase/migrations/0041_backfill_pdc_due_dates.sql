-- ── Backfill PDC due dates ──────────────────────────────────────────
-- Migration 0040 added cheque_due_date to the seven tender-line tables but
-- left it optional, so every PDC recorded before this point has a NULL due
-- date. A NULL never compares as overdue and sorts last on the register
-- forever, which meant the Overdue figure was permanently zero and the
-- pending list — the whole point of the lifecycle work — was unordered.
--
-- There is no way to recover the real maturity date of a cheque already in
-- the drawer, so these are stamped at document date + 30 days: the house
-- default term, and a date that is at least in the right neighbourhood.
-- Anything genuinely different gets corrected by hand on the register.
--
-- Only NULL rows are touched, so this is idempotent and can never overwrite
-- a date someone actually entered. Validation now requires the field going
-- forward (see requireChequeForPdc in lib/constants/tender-types.ts), so
-- this is a one-off closing of the historical gap, not a recurring repair.

update ar_receipt_lines l
set    cheque_due_date = r.date + interval '30 days'
from   ar_receipts r
where  r.id = l.receipt_id
  and  l.transaction_type = 'pdc'
  and  l.cheque_due_date is null;

update ap_payment_lines l
set    cheque_due_date = p.date + interval '30 days'
from   ap_payments p
where  p.id = l.payment_id
  and  l.transaction_type = 'pdc'
  and  l.cheque_due_date is null;

update customer_refund_lines l
set    cheque_due_date = r.date + interval '30 days'
from   customer_refunds r
where  r.id = l.refund_id
  and  l.transaction_type = 'pdc'
  and  l.cheque_due_date is null;

update supplier_refund_lines l
set    cheque_due_date = r.date + interval '30 days'
from   supplier_refunds r
where  r.id = l.refund_id
  and  l.transaction_type = 'pdc'
  and  l.cheque_due_date is null;

update loan_disbursement_lines l
set    cheque_due_date = el.disbursement_date + interval '30 days'
from   employee_loans el
where  el.id = l.loan_id
  and  l.transaction_type = 'pdc'
  and  l.cheque_due_date is null;

update loan_repayment_lines l
set    cheque_due_date = lr.date + interval '30 days'
from   loan_repayments lr
where  lr.id = l.repayment_id
  and  l.transaction_type = 'pdc'
  and  l.cheque_due_date is null;

update owner_transaction_lines l
set    cheque_due_date = ot.date + interval '30 days'
from   owner_transactions ot
where  ot.id = l.transaction_id
  and  l.transaction_type = 'pdc'
  and  l.cheque_due_date is null;
