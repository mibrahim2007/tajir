-- ============================================================
-- 0008: Location-wise stock summary view
-- Computes per-location quantity for each stock item by
-- aggregating purchases, sales, returns, and transfers.
-- ============================================================
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
  ) AS quantity
FROM inventory_lots il
JOIN locations l ON l.tenant_id = il.tenant_id;
