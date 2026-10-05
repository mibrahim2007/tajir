-- ── Direct payment: a customer pays our supplier on our behalf ──────────
-- A trader often tells a customer "don't pay me, pay my supplier" — the money
-- never touches our cash or bank. On the receipt it is a tender line of type
-- 'direct' that names the supplier who was paid, plus free-text Hawala remarks
-- (the hawala/slip reference the customer quotes).
--
-- GL for such a line: DR Accounts Payable (that supplier) instead of DR Cash,
-- against the receipt's usual CR Accounts Receivable (the customer). One line
-- therefore settles both ledgers: the customer owes us less and we owe the
-- supplier less.
--
-- ON DELETE RESTRICT on supplier_id: a supplier who has been paid this way
-- cannot be deleted from under the receipt, same as a supplier with purchases.

alter table public.ar_receipt_lines
  add column if not exists supplier_id    uuid references public.suppliers(id) on delete restrict,
  add column if not exists hawala_remarks text;

alter table public.ar_receipt_lines
  drop constraint if exists ar_receipt_lines_transaction_type_check;
alter table public.ar_receipt_lines
  add constraint ar_receipt_lines_transaction_type_check
  check (transaction_type = any (array['cash', 'pdc', 'online', 'direct']));

-- The supplier is the whole point of a direct line, and only a direct line
-- may carry one — otherwise a cash line could silently reduce a payable.
alter table public.ar_receipt_lines
  drop constraint if exists ar_receipt_lines_direct_supplier;
alter table public.ar_receipt_lines
  add constraint ar_receipt_lines_direct_supplier
  check ((transaction_type = 'direct') = (supplier_id is not null));

create index if not exists ar_receipt_lines_supplier_idx
  on public.ar_receipt_lines (tenant_id, supplier_id)
  where supplier_id is not null;
