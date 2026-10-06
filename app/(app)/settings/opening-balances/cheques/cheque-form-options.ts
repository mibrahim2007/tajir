import { createAdminClient } from '@/lib/supabase/admin'
import type { PartyOption } from '../opening-cheques-table'

/** Banks and the party picker for the opening-cheque add/edit pages. */
export async function loadChequeFormOptions(tenantId: string) {
  const admin = createAdminClient()
  const [{ data: rawCustomers }, { data: rawSuppliers }, { data: rawBanks }] = await Promise.all([
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId),
    admin.from('banks').select('id, name').eq('tenant_id', tenantId).order('name'),
  ])

  // Both party lists in one picker; the value carries the kind so the action
  // knows which subledger a bounce would move.
  const parties: PartyOption[] = [
    ...(rawCustomers ?? []).map((c) => ({ kind: 'customer' as const, id: c.id, name: c.name })),
    ...(rawSuppliers ?? []).map((s) => ({ kind: 'supplier' as const, id: s.id, name: s.name })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  const banks = (rawBanks ?? []).map((b) => ({ id: b.id, name: b.name }))

  return { parties, banks }
}
