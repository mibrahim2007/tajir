alter table sales_orders
  add column if not exists yarn_type   text,
  add column if not exists yarn_weight numeric(15,3),
  add column if not exists multiply_by numeric(15,4) not null default 1;

alter table purchase_orders
  add column if not exists yarn_type   text,
  add column if not exists yarn_weight numeric(15,3),
  add column if not exists multiply_by numeric(15,4) not null default 1;

alter table sale_returns
  add column if not exists yarn_type   text,
  add column if not exists yarn_weight numeric(15,3),
  add column if not exists multiply_by numeric(15,4) not null default 1;

alter table purchase_returns
  add column if not exists yarn_type   text,
  add column if not exists yarn_weight numeric(15,3),
  add column if not exists multiply_by numeric(15,4) not null default 1;