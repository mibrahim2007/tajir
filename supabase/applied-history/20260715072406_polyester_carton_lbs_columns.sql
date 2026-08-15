ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS nos_carton        numeric(15,4),
  ADD COLUMN IF NOT EXISTS weight_per_carton numeric(15,4),
  ADD COLUMN IF NOT EXISTS qty_lbs           numeric(15,4);

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS nos_carton        numeric(15,4),
  ADD COLUMN IF NOT EXISTS weight_per_carton numeric(15,4),
  ADD COLUMN IF NOT EXISTS qty_lbs           numeric(15,4);