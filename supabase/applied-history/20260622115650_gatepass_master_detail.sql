-- Detail table
CREATE TABLE gatepass_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gatepass_id       uuid NOT NULL REFERENCES gatepasses(id) ON DELETE CASCADE,
  purchase_order_id uuid,
  sales_order_id    uuid,
  entry_date        date,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Migrate existing rows (each old gatepass → one item)
INSERT INTO gatepass_items (gatepass_id, purchase_order_id, sales_order_id, entry_date)
SELECT id, purchase_order_id, sales_order_id, entry_date
FROM gatepasses
WHERE purchase_order_id IS NOT NULL OR sales_order_id IS NOT NULL;

-- Fix nullability (these were already made optional in code but DB still had NOT NULL)
ALTER TABLE gatepasses ALTER COLUMN vehicle_number DROP NOT NULL;
ALTER TABLE gatepasses ALTER COLUMN driver_name    DROP NOT NULL;

-- Drop columns that moved to gatepass_items
ALTER TABLE gatepasses DROP COLUMN IF EXISTS purchase_order_id;
ALTER TABLE gatepasses DROP COLUMN IF EXISTS sales_order_id;
ALTER TABLE gatepasses DROP COLUMN IF EXISTS entry_date;