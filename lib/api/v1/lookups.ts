import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type Admin = SupabaseClient<Database>

/** id → name maps for the parties/items/locations a transaction list refers to. */
export async function loadNameMaps(admin: Admin, tenantId: string) {
  const [{ data: suppliers }, { data: customers }, { data: lots }, { data: locations }] = await Promise.all([
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name, count').eq('tenant_id', tenantId),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId),
  ])
  return {
    supplier: new Map((suppliers ?? []).map((s) => [s.id, s.name])),
    customer: new Map((customers ?? []).map((c) => [c.id, c.name])),
    item: new Map((lots ?? []).map((l) => [l.id, { name: l.name, count: l.count }])),
    location: new Map((locations ?? []).map((l) => [l.id, l.name])),
  }
}
