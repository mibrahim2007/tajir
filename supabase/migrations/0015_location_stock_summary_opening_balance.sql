-- ============================================================
-- 0015: Fold opening balance quantity into location_stock_summary
--
-- inventory_lots.current_quantity is a running total that already
-- reflects every location-tagged transaction for the item (it is
-- mutated directly by purchases/sales/returns/transfers). The
-- per-location sums below independently re-derive that same
-- movement from location-tagged rows. To attribute the item's
-- opening balance quantity to its assigned location without
-- double-counting, we subtract the item's total location-tagged
-- net movement from current_quantity to recover the untagged
-- baseline, then add that baseline only at the item's own
-- location_id.
-- ============================================================

CREATE OR REPLACE VIEW location_stock_summary AS
WITH lot_tagged_net AS (
  SELECT
    il.id AS stock_item_id,
    (
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
    ) AS net
  FROM inventory_lots il
)
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
  + CASE WHEN il.location_id = l.id THEN (il.current_quantity - ltn.net) ELSE 0 END
  ) AS quantity
FROM inventory_lots il
JOIN locations l ON l.tenant_id = il.tenant_id
JOIN lot_tagged_net ltn ON ltn.stock_item_id = il.id;
