-- Auto-assigned scannable SKU for inventory lots (barcode payload).
CREATE SEQUENCE IF NOT EXISTS inventory_lot_sku_seq;

ALTER TABLE public.inventory_lots ADD COLUMN IF NOT EXISTS sku text;

-- Backfill existing rows deterministically by creation order (global TJR sequence).
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.inventory_lots
)
UPDATE public.inventory_lots il
SET sku = 'TJR-' || lpad(o.rn::text, 6, '0')
FROM ordered o
WHERE il.id = o.id AND il.sku IS NULL;

-- Advance the sequence past the highest backfilled number.
SELECT setval(
  'inventory_lot_sku_seq',
  COALESCE((SELECT max(split_part(sku, '-', 2)::int) FROM public.inventory_lots), 0),
  true
);

-- Future inserts auto-mint the next SKU; enforce presence + per-tenant uniqueness.
ALTER TABLE public.inventory_lots
  ALTER COLUMN sku SET DEFAULT 'TJR-' || lpad(nextval('inventory_lot_sku_seq')::text, 6, '0'),
  ALTER COLUMN sku SET NOT NULL,
  ADD CONSTRAINT uq_inventory_lots_tenant_sku UNIQUE (tenant_id, sku);
