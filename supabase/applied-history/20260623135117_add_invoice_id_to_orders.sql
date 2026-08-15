ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS invoice_id UUID;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS invoice_id UUID;