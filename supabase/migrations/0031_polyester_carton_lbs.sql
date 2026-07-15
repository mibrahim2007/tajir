-- Polyester line fields: cartons purchased/sold, weight per carton (kg) and the
-- derived quantity in lbs (nos_carton * weight_per_carton / 2.2046). Applied to
-- both purchase and sale lines. Nullable — only populated for Polyester items.
-- Stock quantity still uses `quantity`; qty_lbs only drives the line amount.

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS nos_carton        numeric(15,4),
  ADD COLUMN IF NOT EXISTS weight_per_carton numeric(15,4),
  ADD COLUMN IF NOT EXISTS qty_lbs           numeric(15,4);

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS nos_carton        numeric(15,4),
  ADD COLUMN IF NOT EXISTS weight_per_carton numeric(15,4),
  ADD COLUMN IF NOT EXISTS qty_lbs           numeric(15,4);
