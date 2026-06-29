CREATE TABLE IF NOT EXISTS public.tajir_attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_id     uuid        NOT NULL,
  entity_type  text        NOT NULL,
  storage_path text        NOT NULL,
  filename     text        NOT NULL,
  size         integer     NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tajir_attachments_entry  ON public.tajir_attachments (entry_id);
CREATE INDEX IF NOT EXISTS idx_tajir_attachments_tenant ON public.tajir_attachments (tenant_id);
