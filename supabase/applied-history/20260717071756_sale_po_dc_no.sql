ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS po_no text,
  ADD COLUMN IF NOT EXISTS dc_no text;

CREATE INDEX IF NOT EXISTS sales_orders_po_no_idx
  ON sales_orders (tenant_id, po_no);

CREATE INDEX IF NOT EXISTS sales_orders_dc_no_idx
  ON sales_orders (tenant_id, dc_no);