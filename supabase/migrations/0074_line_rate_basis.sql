-- ── Rate basis per line, not per item type ──────────────────────────────────
--
-- 0071 put the billing formula on the item type. In use, the same item can be
-- bought per lb from one supplier and per bag from another, so the choice now
-- belongs to each LINE: purchase, sale, both returns and opening stock carry a
-- rate_basis
--
--   standard  amount = qty × rate
--   yarn      amount = qty × rate × multiply_by
--   per_lb    cartons × kg = stock; amount = lbs × rate
--   per_kg    cartons × kg = stock; amount = kg × rate
--   per_pack  packs = stock;        amount = packs × rate
--
-- Grade and lot are required on every line whose basis is not 'standard' (the
-- app enforces it), so tenants that sell by count are never asked for them.
--
-- item_types.formula / stock_unit / pack_unit / std_pack_weight / track_* stay
-- in the table but are no longer edited; formula is only the fallback default
-- basis for an item that has never been traded.
--
-- Existing lines are backfilled with their item type's formula, which is the
-- basis they were calculated with, so editing an old invoice keeps its maths.

do $$
declare
  t text;
begin
  foreach t in array array['purchase_orders', 'sales_orders', 'purchase_returns', 'sale_returns', 'stock_opening_balances']
  loop
    execute format('alter table public.%I add column if not exists rate_basis text not null default ''standard''', t);
    if not exists (select 1 from pg_constraint where conname = t || '_rate_basis_check') then
      execute format(
        'alter table public.%I add constraint %I check (rate_basis in (''standard'', ''yarn'', ''per_lb'', ''per_kg'', ''per_pack''))',
        t, t || '_rate_basis_check');
    end if;
    execute format(
      'update public.%I x set rate_basis = it.formula
         from public.inventory_lots l join public.item_types it on it.id = l.item_type_id
        where l.id = x.stock_item_id and x.rate_basis = ''standard'' and it.formula <> ''standard''', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
