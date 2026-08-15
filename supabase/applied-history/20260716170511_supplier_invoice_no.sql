ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_invoice_no text;

CREATE INDEX IF NOT EXISTS purchase_orders_supplier_invoice_no_idx
  ON purchase_orders (tenant_id, supplier_invoice_no);