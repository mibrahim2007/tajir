-- ============================================================
-- 0055: Per-location opening stock balances
--
-- An item's opening quantity used to live on inventory_lots itself
-- (current_quantity + opening_rate, attributed to a single
-- location_id), so a tenant holding the same item in two warehouses
-- on day one had no way to say so — the workaround was to load the
-- whole lot at one location and transfer part of it out.
--
-- This table holds one opening row per (item, location). The item's
-- current_quantity stays the running total it has always been; the
-- opening rows are its per-location breakdown, and their sum is the
-- untagged baseline that location_stock_summary used to re-derive as
-- (current_quantity - tagged movement).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stock_opening_balances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id)        ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.inventory_lots(id) ON DELETE CASCADE,
  -- No ON DELETE: a location holding opening stock must not vanish from under
  -- it, and the restrict surfaces as "Cannot delete location with linked
  -- transactions", the same guard inventory_lots.location_id already gives.
  location_id   uuid NOT NULL REFERENCES public.locations(id),
  -- Deliberately NOT constrained to >= 0. Live data contains items whose
  -- recorded movement exceeds their running total (current_quantity 0 against
  -- a net +5 of tagged movement), which makes the opening baseline negative.
  -- The view this replaces carried those through, so clamping them here would
  -- silently change a location's reported stock. The server action still
  -- refuses a negative quantity, so only this backfill can produce one.
  quantity      numeric(15,3) NOT NULL DEFAULT 0,
  -- Cost per unit at this location. Kept per row because the same item
  -- can have been bought into two warehouses at different costs.
  rate          numeric(18,4) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_stock_opening_balances_rate_non_negative CHECK (rate >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_opening_balances_item_location
  ON public.stock_opening_balances(tenant_id, stock_item_id, location_id);

CREATE INDEX IF NOT EXISTS idx_stock_opening_balances_location
  ON public.stock_opening_balances(tenant_id, location_id);

-- Access is only ever through the service-role admin client inside server
-- actions (which scope by tenant_id). Enable RLS with no policies so the
-- anon/authenticated roles are denied by default, matching every other table.
ALTER TABLE public.stock_opening_balances ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Backfill: recover each item's existing single-location opening
-- figure the same way the old view did — current_quantity minus its
-- location-tagged net movement — and write it as one row.
--
-- The figure is stored verbatim, negatives included: the old view added
-- (current_quantity - net) to the item's location whatever its sign, so
-- anything else here moves a location's reported stock.
-- ------------------------------------------------------------
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

-- Rows that came out as 0/0 carry no information; drop them so the UI
-- does not show an empty location line for every item ever created.
DELETE FROM public.stock_opening_balances WHERE quantity = 0 AND rate = 0;

-- ------------------------------------------------------------
-- location_stock_summary now reads the opening baseline straight from
-- stock_opening_balances instead of re-deriving it, which also drops
-- the lot_tagged_net CTE the old definition needed.
--
-- Items with no opening rows contribute only their location-tagged
-- movement — exactly what they did before when location_id was null.
-- ------------------------------------------------------------
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
