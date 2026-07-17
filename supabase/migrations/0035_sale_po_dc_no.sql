-- Customer's purchase order number (PO No) and our delivery challan number
-- (DC No) for a sale. Both are manual free-text, as printed on the customer's
-- PO and the challan that went out with the goods. Optional — older sales and
-- walk-in customers leave them null.
--
-- Stored per line, repeated across every row sharing an invoice_id, mirroring
-- how serial_number and notes are denormalised (there is no sales_invoices
-- header table).

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS po_no text,
  ADD COLUMN IF NOT EXISTS dc_no text;

-- Backs the Sale Detail report's PO / DC number search.
CREATE INDEX IF NOT EXISTS sales_orders_po_no_idx
  ON sales_orders (tenant_id, po_no);

CREATE INDEX IF NOT EXISTS sales_orders_dc_no_idx
  ON sales_orders (tenant_id, dc_no);
