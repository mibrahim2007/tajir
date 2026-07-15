-- Item sub-types: a sub-type is an item_types row whose parent_id points to its
-- parent type. Deleting a parent cascades to its sub-types (whose items are then
-- unlinked via inventory_lots.item_type_id ON DELETE SET NULL). Top-level types
-- keep parent_id NULL.

ALTER TABLE public.item_types
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.item_types(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_item_types_parent ON public.item_types (parent_id);
