ALTER TABLE gatepass_items
  ADD COLUMN IF NOT EXISTS stock_item_id uuid REFERENCES inventory_lots(id),
  ADD COLUMN IF NOT EXISTS quantity       numeric(15,3);