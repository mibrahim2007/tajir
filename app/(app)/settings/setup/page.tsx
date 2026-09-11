import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTenant } from '@/lib/auth/get-tenant'
import { createAdminClient } from '@/lib/supabase/admin'
import { SetupWizard } from './setup-wizard'
import type { SetupData } from './setup-types'

/*
 * Master Data Setup wizard.
 *
 * Everything a transaction needs to exist before it can be recorded — the
 * business name on the printout, the ledger it posts to, the category and
 * warehouse a stock item lives in, and the parties on either side of the
 * trade — is spread across nine separate screens under Setup. A new tenant
 * discovers the order by hitting "add items from the Inventory page first"
 * messages one at a time. This page walks the same nine screens in
 * dependency order, in one place.
 *
 * It is a thin layer: every step calls the existing server actions. This
 * server component's only job is to read the current state so each step can
 * show what is already there, and re-reading it on router.refresh() is what
 * ticks a step as done.
 */

const RECENT = 8

export default async function SetupWizardPage() {
  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') redirect('/dashboard')

  const admin = createAdminClient()

  const [
    tenant,
    { count: accounts },
    { data: itemTypes },
    { data: locations },
    { count: items },
    { data: recentItems },
    { count: customers },
    { data: recentCustomers },
    { count: suppliers },
    { data: recentSuppliers },
    { data: banks },
    { data: owners },
    { data: employees },
    { data: agents },
    { count: team },
  ] = await Promise.all([
    getTenant(tenantId),
    admin.from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin.from('item_types').select('id, name, parent_id').eq('tenant_id', tenantId).order('name'),
    admin.from('locations').select('id, name, address').eq('tenant_id', tenantId).order('created_at'),
    admin.from('inventory_lots').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin.from('inventory_lots').select('id, name, sku, count, unit_of_measure').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(RECENT),
    admin.from('tajir_customers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(RECENT),
    admin.from('suppliers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin.from('suppliers').select('id, name').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(RECENT),
    admin.from('banks').select('id, name, account_number, branch').eq('tenant_id', tenantId).order('created_at'),
    admin.from('owners').select('id, name, profit_share_pct').eq('tenant_id', tenantId).order('created_at'),
    admin.from('employees').select('id, name, designation').eq('tenant_id', tenantId).order('created_at'),
    admin.from('agents').select('id, name').eq('tenant_id', tenantId).order('created_at'),
    admin.from('tenant_users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ])

  const data: SetupData = {
    tenant: { name: tenant.name, ntn: tenant.ntn ?? '' },
    counts: {
      accounts:  accounts ?? 0,
      itemTypes: (itemTypes ?? []).filter((x) => !x.parent_id).length,
      locations: (locations ?? []).length,
      items:     items ?? 0,
      customers: customers ?? 0,
      suppliers: suppliers ?? 0,
      banks:     (banks ?? []).length,
      owners:    (owners ?? []).length,
      employees: (employees ?? []).length,
      agents:    (agents ?? []).length,
      team:      team ?? 0,
    },
    itemTypes: (itemTypes ?? []).map((x) => ({ id: x.id, name: x.name, parentId: x.parent_id ?? null })),
    locations: (locations ?? []).map((l) => ({ id: l.id, name: l.name, address: l.address ?? null })),
    recentItems: (recentItems ?? []).map((i) => ({
      id: i.id, name: i.name, sku: i.sku, count: i.count == null ? null : String(i.count), unit: i.unit_of_measure ?? null,
    })),
    recentCustomers: (recentCustomers ?? []).map((c) => ({ id: c.id, name: c.name })),
    recentSuppliers: (recentSuppliers ?? []).map((s) => ({ id: s.id, name: s.name })),
    banks:     (banks ?? []).map((b) => ({ id: b.id, name: b.name, accountNumber: b.account_number ?? null, branch: b.branch ?? null })),
    owners:    (owners ?? []).map((o) => ({ id: o.id, name: o.name, sharePct: Number(o.profit_share_pct ?? 0) })),
    employees: (employees ?? []).map((e) => ({ id: e.id, name: e.name, designation: e.designation ?? null })),
    agents:    (agents ?? []).map((a) => ({ id: a.id, name: a.name })),
  }

  return <SetupWizard data={data} />
}
