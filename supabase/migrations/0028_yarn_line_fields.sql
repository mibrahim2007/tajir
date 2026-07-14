-- ── Per-line yarn fields on trading documents ───────────────────────
-- Adds Yarn Type, Yarn Weight, and Multiply By to each order-line row.
-- These are captured only for lines whose item's Item Type is "Yarn"; the UI
-- hides them otherwise. `multiply_by` scales the line's monetary amount
-- (pkr_equivalent = quantity × rate × fx × multiply_by), so it defaults to 1 —
-- existing rows and non-yarn lines are a no-op. Stock quantity is unaffected.

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
