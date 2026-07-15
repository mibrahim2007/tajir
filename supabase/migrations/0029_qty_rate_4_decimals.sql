-- Widen quantity & rate on purchase_orders and sales_orders from 3/2 to 4 decimal places.
-- location_stock_summary depends on quantity, so drop & recreate it around the ALTERs.

DROP VIEW IF EXISTS location_stock_summary;

ALTER TABLE purchase_orders ALTER COLUMN quantity TYPE numeric(15,4);
ALTER TABLE purchase_orders ALTER COLUMN rate     TYPE numeric(15,4);
ALTER TABLE sales_orders    ALTER COLUMN quantity TYPE numeric(15,4);
ALTER TABLE sales_orders    ALTER COLUMN rate     TYPE numeric(15,4);

CREATE VIEW location_stock_summary AS
 WITH lot_tagged_net AS (
         SELECT il_1.id AS stock_item_id,
            COALESCE(( SELECT sum(po.quantity) AS sum
                   FROM purchase_orders po
                  WHERE po.stock_item_id = il_1.id AND po.tenant_id = il_1.tenant_id AND po.location_id IS NOT NULL), 0::numeric) - COALESCE(( SELECT sum(so.quantity) AS sum
                   FROM sales_orders so
                  WHERE so.stock_item_id = il_1.id AND so.tenant_id = il_1.tenant_id AND so.location_id IS NOT NULL), 0::numeric) + COALESCE(( SELECT sum(sr.quantity) AS sum
                   FROM sale_returns sr
                  WHERE sr.stock_item_id = il_1.id AND sr.tenant_id = il_1.tenant_id AND sr.location_id IS NOT NULL), 0::numeric) - COALESCE(( SELECT sum(pr.quantity) AS sum
                   FROM purchase_returns pr
                  WHERE pr.stock_item_id = il_1.id AND pr.tenant_id = il_1.tenant_id AND pr.location_id IS NOT NULL), 0::numeric) + COALESCE(( SELECT sum(st.quantity) AS sum
                   FROM stock_transfers st
                  WHERE st.stock_item_id = il_1.id AND st.tenant_id = il_1.tenant_id AND st.to_location_id IS NOT NULL), 0::numeric) - COALESCE(( SELECT sum(st.quantity) AS sum
                   FROM stock_transfers st
                  WHERE st.stock_item_id = il_1.id AND st.tenant_id = il_1.tenant_id AND st.from_location_id IS NOT NULL), 0::numeric) AS net
           FROM inventory_lots il_1
        )
 SELECT il.id AS stock_item_id,
    il.tenant_id,
    il.name AS stock_item_name,
    il.count::text AS yarn_count,
    l.id AS location_id,
    l.name AS location_name,
    COALESCE(( SELECT sum(po.quantity) AS sum
           FROM purchase_orders po
          WHERE po.stock_item_id = il.id AND po.location_id = l.id AND po.tenant_id = il.tenant_id), 0::numeric) - COALESCE(( SELECT sum(so.quantity) AS sum
           FROM sales_orders so
          WHERE so.stock_item_id = il.id AND so.location_id = l.id AND so.tenant_id = il.tenant_id), 0::numeric) + COALESCE(( SELECT sum(sr.quantity) AS sum
           FROM sale_returns sr
          WHERE sr.stock_item_id = il.id AND sr.location_id = l.id AND sr.tenant_id = il.tenant_id), 0::numeric) - COALESCE(( SELECT sum(pr.quantity) AS sum
           FROM purchase_returns pr
          WHERE pr.stock_item_id = il.id AND pr.location_id = l.id AND pr.tenant_id = il.tenant_id), 0::numeric) + COALESCE(( SELECT sum(st.quantity) AS sum
           FROM stock_transfers st
          WHERE st.stock_item_id = il.id AND st.to_location_id = l.id AND st.tenant_id = il.tenant_id), 0::numeric) - COALESCE(( SELECT sum(st.quantity) AS sum
           FROM stock_transfers st
          WHERE st.stock_item_id = il.id AND st.from_location_id = l.id AND st.tenant_id = il.tenant_id), 0::numeric) +
        CASE
            WHEN il.location_id = l.id THEN il.current_quantity - ltn.net
            ELSE 0::numeric
        END AS quantity
   FROM inventory_lots il
     JOIN locations l ON l.tenant_id = il.tenant_id
     JOIN lot_tagged_net ltn ON ltn.stock_item_id = il.id;
