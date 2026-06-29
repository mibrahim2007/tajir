CREATE TABLE IF NOT EXISTS public.item_types (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_item_types_tenant ON public.item_types (tenant_id);

ALTER TABLE public.inventory_lots
  ADD COLUMN IF NOT EXISTS item_type_id uuid
    REFERENCES public.item_types(id) ON DELETE SET NULL;
