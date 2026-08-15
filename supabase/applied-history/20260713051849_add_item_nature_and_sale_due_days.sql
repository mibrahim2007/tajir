-- Item nature: 'inventory' (stockable, default) or 'service' (non-stockable,
-- e.g. freight recharged to a customer). Service items skip stock/COGS on sale.
alter table inventory_lots
  add column if not exists item_nature text not null default 'inventory';

alter table inventory_lots
  drop constraint if exists inventory_lots_item_nature_check;
alter table inventory_lots
  add constraint inventory_lots_item_nature_check
  check (item_nature in ('inventory', 'service'));

-- Optional payment terms in days; the app fills payment_due_date = date + due_days.
alter table sales_orders
  add column if not exists due_days integer;