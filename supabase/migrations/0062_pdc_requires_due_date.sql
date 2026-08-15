-- ── A PDC must carry its due date ───────────────────────────────────
-- Zod already refuses a PDC without a due date on both the client and the
-- server (PDC_DUE_DATE_REQUIRED). That was not enough: edit-ar-receipt and
-- edit-supplier-refund built their tender rows WITHOUT the cheque_due_date
-- column, so validation passed on a date the insert then silently dropped.
-- Ten receipt lines lost their date that way, and because a cheque with no due
-- date never becomes overdue (see 0040_pdc_lifecycle), each one also vanished
-- from the pending-cheque list it exists to appear on.
--
-- Application validation cannot catch that class of bug, because the bug is
-- BELOW it — the value was valid and then not written. Only the database can.
--
-- NOT VALID is deliberate. It enforces the rule on every INSERT and UPDATE
-- from now on, while leaving the rows that already lost their date readable.
-- Those are being corrected by hand through the edit screen; editing one
-- rewrites its lines, so the constraint forces the date to be supplied at that
-- point rather than blocking the whole record. Once none are left, run:
--
--   alter table ar_receipt_lines validate constraint ar_receipt_lines_pdc_due_date;
--
-- to promote it to fully verified.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'ar_receipt_lines',
    'ap_payment_lines',
    'supplier_refund_lines',
    'customer_refund_lines',
    'owner_transaction_lines',
    'loan_disbursement_lines',
    'loan_repayment_lines',
    'agent_payment_lines'
  ] loop
    execute format('alter table %I drop constraint if exists %I', tbl, tbl || '_pdc_due_date');
    -- Only a PDC is dated. Cash and online lines legitimately carry no due
    -- date, and an online line may still record a reference/cheque number.
    execute format(
      'alter table %I add constraint %I check (transaction_type <> ''pdc'' or cheque_due_date is not null) not valid',
      tbl, tbl || '_pdc_due_date');
  end loop;
end $$;
