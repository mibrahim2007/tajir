-- ── Item type profile: the item type decides how an item's lines are measured
--    and billed, and every stock item must have one ──────────────────────────
--
-- Until now the trading forms guessed an item's behaviour from its item type's
-- NAME: exactly "Yarn" showed the yarn fields and multiplier, and any name
-- containing "polyester" (or "ployester") showed cartons / weight / QTY LBS.
-- Those rules now live in columns on item_types, picked by the user:
--
--   formula         how a trading line's amount is worked out
--                     standard  amount = qty × rate
--                     yarn      amount = qty × rate × multiply_by (+ yarn fields)
--                     per_lb    cartons × kg/carton → QTY LBS; amount = lbs × rate
--                     per_kg    cartons × kg/carton → kg;      amount = kg × rate
--                     per_pack  cartons (packs);               amount = packs × rate
--   stock_unit      the unit stock is kept in (KG, Piece, Bag, …)
--   pack_unit       what a pack is called (Carton, Bag, Cone, …); per_lb/per_kg/per_pack
--   std_pack_weight standard kg per pack, pre-filled on trading lines
--   track_grade     reserved for grade-wise stock (next change)
--   track_lot       reserved for lot-wise stock (next change)
--
-- A sub-type carries the same profile as its parent; the app copies it down
-- whenever the parent is saved.
--
-- inventory_lots.item_type_id becomes NOT NULL. Items without a type are moved
-- to a per-tenant "General" type (formula standard), and the FK changes from
-- ON DELETE SET NULL to RESTRICT so a type in use can no longer be deleted.

alter table public.item_types
  add column if not exists formula         text not null default 'standard',
  add column if not exists stock_unit      text,
  add column if not exists pack_unit       text,
  add column if not exists std_pack_weight numeric(12,3),
  add column if not exists track_grade     boolean not null default false,
  add column if not exists track_lot       boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'item_types_formula_check') then
    alter table public.item_types
      add constraint item_types_formula_check
      check (formula in ('standard', 'yarn', 'per_lb', 'per_kg', 'per_pack'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'item_types_std_pack_weight_check') then
    alter table public.item_types
      add constraint item_types_std_pack_weight_check
      check (std_pack_weight is null or std_pack_weight > 0);
  end if;
end $$;

-- Backfill the formula from the old name rules. A type's own name wins; a
-- sub-type whose name says nothing takes its parent's rule.
update public.item_types
   set formula = 'per_lb', stock_unit = coalesce(stock_unit, 'KG'), pack_unit = coalesce(pack_unit, 'Carton')
 where formula = 'standard'
   and (name ilike '%polyester%' or name ilike '%ployester%');

update public.item_types
   set formula = 'yarn'
 where formula = 'standard'
   and lower(btrim(name)) = 'yarn';

update public.item_types c
   set formula = p.formula, stock_unit = coalesce(c.stock_unit, p.stock_unit), pack_unit = coalesce(c.pack_unit, p.pack_unit)
  from public.item_types p
 where c.parent_id = p.id
   and c.formula = 'standard'
   and p.formula <> 'standard';

-- Items without a type → the tenant's "General" type (created if missing).
insert into public.item_types (tenant_id, name, formula)
select distinct l.tenant_id, 'General', 'standard'
  from public.inventory_lots l
 where l.item_type_id is null
on conflict (tenant_id, name) do nothing;

update public.inventory_lots l
   set item_type_id = t.id
  from public.item_types t
 where l.item_type_id is null
   and t.tenant_id = l.tenant_id
   and t.name = 'General';

alter table public.inventory_lots alter column item_type_id set not null;

-- Swap the FK to RESTRICT, whatever the existing constraint is called.
do $$
declare
  fk text;
begin
  for fk in
    select c.conname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.conrelid = 'public.inventory_lots'::regclass
       and c.contype = 'f'
       and a.attname = 'item_type_id'
  loop
    execute format('alter table public.inventory_lots drop constraint %I', fk);
  end loop;
end $$;

alter table public.inventory_lots
  add constraint inventory_lots_item_type_id_fkey
  foreign key (item_type_id) references public.item_types(id) on delete restrict;

notify pgrst, 'reload schema';
