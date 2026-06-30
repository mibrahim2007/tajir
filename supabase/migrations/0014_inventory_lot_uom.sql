ALTER TABLE public.inventory_lots
  ADD COLUMN IF NOT EXISTS unit_of_measure text;
