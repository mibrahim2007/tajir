ALTER TABLE public.item_types
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.item_types(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_item_types_parent ON public.item_types (parent_id);