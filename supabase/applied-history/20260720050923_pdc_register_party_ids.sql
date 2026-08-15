drop view if exists pdc_register;
create view pdc_register as
  select 'ar_receipt' as source, l.id as line_id, l.tenant_id, l.receipt_id as document_id,
         r.serial_number as doc_serial, r.date as doc_date,
         c.name as party_name, r.customer_id as party_id, 'customer' as party_kind,
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'in' as direction, 'accounts_receivable' as counter_key, l.pdc_status, l.settled_at
    from ar_receipt_lines l
    join ar_receipts r on r.id = l.receipt_id
    left join tajir_customers c on c.id = r.customer_id
   where l.transaction_type = 'pdc'
  union all
  select 'ap_payment', l.id, l.tenant_id, l.payment_id,
         p.serial_number, p.date, s.name, p.supplier_id, 'supplier',
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'out', 'accounts_payable', l.pdc_status, l.settled_at
    from ap_payment_lines l
    join ap_payments p on p.id = l.payment_id
    left join suppliers s on s.id = p.supplier_id
   where l.transaction_type = 'pdc'
  union all
  select 'customer_refund', l.id, l.tenant_id, l.refund_id,
         r.serial_number, r.date, c.name, r.customer_id, 'customer',
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'out', 'accounts_receivable', l.pdc_status, l.settled_at
    from customer_refund_lines l
    join customer_refunds r on r.id = l.refund_id
    left join tajir_customers c on c.id = r.customer_id
   where l.transaction_type = 'pdc'
  union all
  select 'supplier_refund', l.id, l.tenant_id, l.refund_id,
         r.serial_number, r.date, s.name, r.supplier_id, 'supplier',
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'in', 'accounts_payable', l.pdc_status, l.settled_at
    from supplier_refund_lines l
    join supplier_refunds r on r.id = l.refund_id
    left join suppliers s on s.id = r.supplier_id
   where l.transaction_type = 'pdc'
  union all
  select 'employee_loan', l.id, l.tenant_id, l.loan_id,
         el.serial_number, el.disbursement_date, e.name, el.employee_id, 'employee',
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'out', 'employee_loans_receivable', l.pdc_status, l.settled_at
    from loan_disbursement_lines l
    join employee_loans el on el.id = l.loan_id
    left join employees e on e.id = el.employee_id
   where l.transaction_type = 'pdc'
  union all
  select 'loan_repayment', l.id, l.tenant_id, l.repayment_id,
         lr.serial_number, lr.date, e.name, lr.employee_id, 'employee',
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         'in', 'employee_loans_receivable', l.pdc_status, l.settled_at
    from loan_repayment_lines l
    join loan_repayments lr on lr.id = l.repayment_id
    left join employees e on e.id = lr.employee_id
   where l.transaction_type = 'pdc'
  union all
  select 'owner_transaction', l.id, l.tenant_id, l.transaction_id,
         ot.serial_number, ot.date, o.name, ot.owner_id, 'owner',
         l.cheque_number, l.cheque_due_date, l.bank_id, l.amount,
         case when ot.txn_type = 'withdrawal' then 'out' else 'in' end,
         case when ot.txn_type = 'withdrawal' then 'owners_drawings' else 'owners_capital' end,
         l.pdc_status, l.settled_at
    from owner_transaction_lines l
    join owner_transactions ot on ot.id = l.transaction_id
    left join owners o on o.id = ot.owner_id
   where l.transaction_type = 'pdc';