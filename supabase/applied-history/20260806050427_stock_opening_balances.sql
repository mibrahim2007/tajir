CREATE TABLE IF NOT EXISTS public.stock_opening_balances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id)        ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.inventory_lots(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES public.locations(id),
  -- Deliberately NOT constrained to >= 0: live data contains items whose
  -- recorded movement exceeds their running total, making the opening baseline
  -- negative. The view this replaces carried those through.
  quantity      numeric(15,3) NOT NULL DEFAULT 0,
  rate          numeric(18,4) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_stock_opening_balances_rate_non_negative CHECK (rate >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_opening_balances_item_location
  ON public.stock_opening_balances(tenant_id, stock_item_id, location_id);

CREATE INDEX IF NOT EXISTS idx_stock_opening_balances_location
  ON public.stock_opening_balances(tenant_id, location_id);

ALTER TABLE public.stock_opening_balances ENABLE ROW LEVEL SECURITY;

INSERT INTO public.stock_opening_balances (tenant_id, stock_item_id, location_id, quantity, rate)
SELECT
  il.tenant_id,
  il.id,
  il.location_id,
  (
    il.current_quantity - (
        COALESCE((SELECT SUM(po.quantity) FROM purchase_orders po
          WHERE po.stock_item_id = il.id AND po.tenant_id = il.tenant_id AND po.location_id IS NOT NULL), 0)
      - COALESCE((SELECT SUM(so.quantity) FROM sales_orders so
          WHERE so.stock_item_id = il.id AND so.tenant_id = il.tenant_id AND so.location_id IS NOT NULL), 0)
      + COALESCE((SELECT SUM(sr.quantity) FROM sale_returns sr
          WHERE sr.stock_item_id = il.id AND sr.tenant_id = il.tenant_id AND sr.location_id IS NOT NULL), 0)
      - COALESCE((SELECT SUM(pr.quantity) FROM purchase_returns pr
          WHERE pr.stock_item_id = il.id AND pr.tenant_id = il.tenant_id AND pr.location_id IS NOT NULL), 0)
      + COALESCE((SELECT SUM(st.quantity) FROM stock_transfers st
          WHERE st.stock_item_id = il.id AND st.tenant_id = il.tenant_id AND st.to_location_id IS NOT NULL), 0)
      - COALESCE((SELECT SUM(st.quantity) FROM stock_transfers st
          WHERE st.stock_item_id = il.id AND st.tenant_id = il.tenant_id AND st.from_location_id IS NOT NULL), 0)
    )
  ) AS opening_quantity,
  COALESCE(il.opening_rate, 0)
FROM inventory_lots il
WHERE il.location_id IS NOT NULL
ON CONFLICT (tenant_id, stock_item_id, location_id) DO NOTHING;

DELETE FROM public.stock_opening_balances WHERE quantity = 0 AND rate = 0;

DROP VIEW IF EXISTS location_stock_summary;

CREATE VIEW location_stock_summary AS
SELECT
  il.id   AS stock_item_id,
  il.tenant_id,
  il.name AS stock_item_name,
  il.count::text AS yarn_count,
  l.id    AS location_id,
  l.name  AS location_name,
  (
    COALESCE((SELECT SUM(po.quantity) FROM purchase_orders po
      WHERE po.stock_item_id = il.id AND po.location_id = l.id AND po.tenant_id = il.tenant_id), 0)
  - COALESCE((SELECT SUM(so.quantity) FROM sales_orders so
      WHERE so.stock_item_id = il.id AND so.location_id = l.id AND so.tenant_id = il.tenant_id), 0)
  + COALESCE((SELECT SUM(sr.quantity) FROM sale_returns sr
      WHERE sr.stock_item_id = il.id AND sr.location_id = l.id AND sr.tenant_id = il.tenant_id), 0)
  - COALESCE((SELECT SUM(pr.quantity) FROM purchase_returns pr
      WHERE pr.stock_item_id = il.id AND pr.location_id = l.id AND pr.tenant_id = il.tenant_id), 0)
  + COALESCE((SELECT SUM(st.quantity) FROM stock_transfers st
      WHERE st.stock_item_id = il.id AND st.to_location_id = l.id AND st.tenant_id = il.tenant_id), 0)
  - COALESCE((SELECT SUM(st.quantity) FROM stock_transfers st
      WHERE st.stock_item_id = il.id AND st.from_location_id = l.id AND st.tenant_id = il.tenant_id), 0)
  + COALESCE(sob.quantity, 0)
  ) AS quantity
FROM inventory_lots il
JOIN locations l ON l.tenant_id = il.tenant_id
LEFT JOIN stock_opening_balances sob
  ON sob.stock_item_id = il.id
 AND sob.location_id   = l.id
 AND sob.tenant_id     = il.tenant_id;