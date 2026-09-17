-- ── Tenant-scoped API keys for third-party integrations ─────────────
-- A tenant owner can mint keys that let an external application read that
-- tenant's data through /api/v1/*. The plaintext key is shown exactly once at
-- creation; only its SHA-256 hash is stored. Scopes limit what a key may read.
--
-- Access from the app goes through the service-role client with an explicit
-- tenant_id filter, matching every other table (see 0060). RLS below is
-- defence in depth so a user JWT can never see another tenant's keys, and so
-- assistants cannot manage keys at all — only owners.

create table api_keys (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,                      -- "Accountant sync", "Power BI"
  key_prefix    text not null,                      -- first 12 chars, for display/lookup
  key_hash      text not null unique,               -- sha256 hex of the full key
  scopes        text[] not null default '{}',       -- e.g. {customers:read, ledger:read}
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz,                        -- null = no expiry
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  constraint api_keys_scopes_known check (
    scopes <@ array[
      'customers:read',
      'suppliers:read',
      'ledger:read',
      'sales:read',
      'purchases:read',
      'inventory:read',
      'reports:read'
    ]::text[]
  )
);

create index api_keys_tenant_idx on api_keys(tenant_id);
create index api_keys_prefix_idx on api_keys(key_prefix);

alter table api_keys enable row level security;

drop policy if exists "api_keys: owner select" on api_keys;
drop policy if exists "api_keys: owner insert" on api_keys;
drop policy if exists "api_keys: owner update" on api_keys;
drop policy if exists "api_keys: owner delete" on api_keys;

create policy "api_keys: owner select" on api_keys for select
  using (
    tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid
    and ((auth.jwt() -> 'app_metadata') ->> 'role') = 'owner'
  );
create policy "api_keys: owner insert" on api_keys for insert
  with check (
    tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid
    and ((auth.jwt() -> 'app_metadata') ->> 'role') = 'owner'
  );
create policy "api_keys: owner update" on api_keys for update
  using (
    tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid
    and ((auth.jwt() -> 'app_metadata') ->> 'role') = 'owner'
  );
create policy "api_keys: owner delete" on api_keys for delete
  using (
    tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid
    and ((auth.jwt() -> 'app_metadata') ->> 'role') = 'owner'
  );

-- ── Per-request log so the tenant can see what the third party pulled ──
-- Append-only. Written by the service-role client from the API route.

create table api_key_requests (
  id            bigint generated always as identity primary key,
  api_key_id    uuid not null references api_keys(id) on delete cascade,
  tenant_id     uuid not null references tenants(id) on delete cascade,
  method        text not null,
  path          text not null,
  status        int  not null,
  row_count     int,
  ip            inet,
  created_at    timestamptz not null default now()
);

create index api_key_requests_key_idx on api_key_requests(api_key_id, created_at desc);
create index api_key_requests_tenant_idx on api_key_requests(tenant_id, created_at desc);

alter table api_key_requests enable row level security;

drop policy if exists "api_key_requests: owner select" on api_key_requests;
create policy "api_key_requests: owner select" on api_key_requests for select
  using (
    tenant_id = (((auth.jwt() -> 'app_metadata') ->> 'tenant_id'))::uuid
    and ((auth.jwt() -> 'app_metadata') ->> 'role') = 'owner'
  );
-- No insert/update/delete policies: only the service role writes here.
