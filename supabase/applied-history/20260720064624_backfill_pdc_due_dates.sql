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