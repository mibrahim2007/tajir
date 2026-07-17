-- Supplier's own invoice/bill number for a purchase, as printed on the document
-- the supplier sent us. Distinct from `serial_number` (our generated voucher no)
-- and `invoice_id` (our internal grouping UUID). Optional — older purchases and
-- suppliers who don't number their bills leave it null.
--
-- Stored per line, repeated across every row sharing an invoice_id, mirroring
-- how serial_number is denormalised (there is no purchase_invoices header table).

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_invoice_no text;

-- Backs the Purchase Detail report's supplier-invoice-number search.
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_invoice_no_idx
  ON purchase_orders (tenant_id, supplier_invoice_no);
