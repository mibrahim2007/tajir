// Server-side generation & teardown for the Playground demo generator.
//
// Master data (item types, items, locations, parties, employees) is inserted
// directly with the admin client so we capture every row id and avoid the
// party-mirroring side effects of the create actions. Invoices go through the
// real create actions so journal entries, serials and stock movements are all
// correct — and teardown uses the matching delete actions to reverse them.
//
// Every created id is recorded in demo_batch_rows so the whole batch can be
// removed cleanly, in reverse dependency order.

import { createAdminClient } from '@/lib/supabase/admin'
import { createSaleInvoiceAction } from '@/app/actions/create-sale-invoice'
import { createPurchaseInvoiceAction } from '@/app/actions/create-purchase-invoice'
import { deleteSaleInvoiceAction } from '@/app/actions/delete-sale-invoice'
import { deletePurchaseInvoiceAction } from '@/app/actions/delete-purchase-invoice'
import {
  resolveItemType, SUPPLIER_NAMES, CUSTOMER_NAMES, EMPLOYEE_NAMES, DESIGNATIONS, CITIES,
} from './catalog'
import type { DemoConfig, DemoSummary, DemoUserCredential, GenerateResult, DemoBatchInfo } from './types'

// ── small helpers ────────────────────────────────────────────────────────
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function tempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => chars[b % chars.length]).join('')
}

/** Cycle a name pool, appending an index once it wraps, plus the batch tag. */
function partyName(pool: string[], i: number, tag: string): string {
  const base = pool[i % pool.length]
  const wrap = Math.floor(i / pool.length)
  return `${base}${wrap > 0 ? ` ${wrap + 1}` : ''} [${tag}]`
}

type ItemRef = { id: string; rate: number }

// ── generation ───────────────────────────────────────────────────────────
export async function runGeneration(
  tenantId: string,
  userId: string,
  config: DemoConfig,
): Promise<GenerateResult> {
  const admin = createAdminClient()

  const { data: batch, error: batchErr } = await admin
    .from('demo_batches')
    .insert({ tenant_id: tenantId, created_by: userId, auto_remove: config.autoRemove, config })
    .select('id')
    .single()
  if (batchErr || !batch) throw new Error('Could not start a demo batch')

  const batchId = batch.id as string
  const tag = batchId.slice(0, 4).toUpperCase()

  const rows: { entity: string; row_id: string }[] = []
  const rec = (entity: string, rowId: string) => rows.push({ entity, row_id: rowId })
  const summary: DemoSummary = {
    itemTypes: 0, items: 0, locations: 0, employees: 0, suppliers: 0,
    customers: 0, users: 0, purchaseInvoices: 0, saleInvoices: 0,
  }
  const credentials: DemoUserCredential[] = []

  // Sales/purchases post to the ledger, so the chart of accounts must exist.
  const { count: coaCount } = await admin
    .from('chart_of_accounts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (!coaCount) await admin.rpc('seed_standard_coa', { p_tenant_id: tenantId })

  // ── item types (reuse an existing type of the same name; only record ours) ──
  const typeEntries: { id: string; template: ReturnType<typeof resolveItemType> }[] = []
  for (const typeName of config.itemTypes) {
    const template = resolveItemType(typeName)
    const { data: existing } = await admin
      .from('item_types').select('id').eq('tenant_id', tenantId).eq('name', template.name).maybeSingle()
    let id = existing?.id as string | undefined
    if (!id) {
      const { data: created } = await admin
        .from('item_types').insert({ tenant_id: tenantId, name: template.name }).select('id').single()
      if (!created) continue
      id = created.id as string
      rec('item_type', id); summary.itemTypes++
    }
    typeEntries.push({ id, template })
  }

  // ── items ──
  const inventoryItems: ItemRef[] = []
  const serviceItems: ItemRef[] = []
  for (const { id: typeId, template } of typeEntries) {
    const isService = template.unit === 'service'
    for (let i = 0; i < config.itemsPerType; i++) {
      const base = template.items[i % template.items.length]
      const wrap = Math.floor(i / template.items.length)
      const itemName = `${base}${wrap > 0 ? ` ${wrap + 1}` : ''} [${tag}]`
      const sellRate = rint(template.rate[0], template.rate[1])
      const { data: item } = await admin.from('inventory_lots').insert({
        tenant_id: tenantId,
        name: itemName,
        item_nature: isService ? 'service' : 'inventory',
        opening_rate: Math.round(sellRate * 0.72),
        unit_of_measure: template.unit,
        item_type_id: typeId,
      }).select('id').single()
      if (!item) continue
      rec('item', item.id); summary.items++
      ;(isService ? serviceItems : inventoryItems).push({ id: item.id, rate: sellRate })
    }
  }

  // ── locations ──
  const locationIds: string[] = []
  for (let i = 0; i < config.locations; i++) {
    const city = CITIES[i % CITIES.length]
    const { data: loc } = await admin.from('locations').insert({
      tenant_id: tenantId, name: `${city} Store ${i + 1} [${tag}]`, address: `${city}, Pakistan`,
    }).select('id').single()
    if (!loc) continue
    rec('location', loc.id); summary.locations++; locationIds.push(loc.id)
  }

  // ── suppliers ──
  const supplierIds: string[] = []
  for (let i = 0; i < config.suppliers; i++) {
    const { data: sup } = await admin.from('suppliers').insert({
      tenant_id: tenantId, name: partyName(SUPPLIER_NAMES, i, tag),
      opening_balance: 0, opening_balance_currency: 'PKR', opening_balance_pkr_equivalent: 0,
    }).select('id').single()
    if (!sup) continue
    rec('supplier', sup.id); summary.suppliers++; supplierIds.push(sup.id)
  }

  // ── customers ──
  const customerIds: string[] = []
  for (let i = 0; i < config.customers; i++) {
    const { data: cust } = await admin.from('tajir_customers').insert({
      tenant_id: tenantId, name: partyName(CUSTOMER_NAMES, i, tag), status: 'active',
      opening_balance: 0, opening_balance_currency: 'PKR', opening_balance_pkr_equivalent: 0,
    }).select('id').single()
    if (!cust) continue
    rec('customer', cust.id); summary.customers++; customerIds.push(cust.id)
  }

  // ── employees ──
  for (let i = 0; i < config.employees; i++) {
    const { data: emp } = await admin.from('employees').insert({
      tenant_id: tenantId, name: `${EMPLOYEE_NAMES[i % EMPLOYEE_NAMES.length]}${i >= EMPLOYEE_NAMES.length ? ` ${Math.floor(i / EMPLOYEE_NAMES.length) + 1}` : ''}`,
      designation: pick(DESIGNATIONS), monthly_salary: rint(25, 120) * 1000,
      employee_code: `EMP-${tag}-${String(i + 1).padStart(3, '0')}`, is_active: true,
    }).select('id').single()
    if (!emp) continue
    rec('employee', emp.id); summary.employees++
  }

  // ── users (real assistant login accounts) ──
  for (let i = 0; i < config.users; i++) {
    const email = `demo-${tag.toLowerCase()}-${i + 1}@tajir-demo.test`
    const pass = tempPassword()
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password: pass,
      app_metadata: { role: 'assistant', tenant_id: tenantId, must_change_password: true },
      email_confirm: true,
    })
    if (error || !created.user) continue
    const uid = created.user.id
    const { error: linkErr } = await admin.from('tenant_users').insert({ tenant_id: tenantId, user_id: uid, role: 'assistant' })
    if (linkErr) { await admin.auth.admin.deleteUser(uid); continue }
    rec('user', uid); summary.users++
    credentials.push({ email, tempPassword: pass })
  }

  // ── transactions ──
  const salePool = [...inventoryItems, ...serviceItems]
  if (config.days > 0 && salePool.length > 0) {
    // Transactions need a location, a supplier and a customer. If the user asked
    // for none, mint one fallback of each (recorded so cleanup removes it too).
    let txLocationId = locationIds[0]
    if (!txLocationId) {
      const { data: loc } = await admin.from('locations')
        .insert({ tenant_id: tenantId, name: `Demo Warehouse [${tag}]`, address: 'Pakistan' }).select('id').single()
      if (loc) { txLocationId = loc.id; rec('location', loc.id); summary.locations++ }
    }
    let supIds = supplierIds
    if (supIds.length === 0 && inventoryItems.length > 0) {
      const { data: sup } = await admin.from('suppliers')
        .insert({ tenant_id: tenantId, name: `Demo Supplier [${tag}]`, opening_balance: 0, opening_balance_currency: 'PKR', opening_balance_pkr_equivalent: 0 }).select('id').single()
      if (sup) { supIds = [sup.id]; rec('supplier', sup.id); summary.suppliers++ }
    }
    let custIds = customerIds
    if (custIds.length === 0) {
      const { data: cust } = await admin.from('tajir_customers')
        .insert({ tenant_id: tenantId, name: `Demo Customer [${tag}]`, status: 'active', opening_balance: 0, opening_balance_currency: 'PKR', opening_balance_pkr_equivalent: 0 }).select('id').single()
      if (cust) { custIds = [cust.id]; rec('customer', cust.id); summary.customers++ }
    }

    // Purchases first — stock every inventory item well above what sales consume.
    if (txLocationId && supIds.length > 0 && inventoryItems.length > 0) {
      for (let i = 0; i < inventoryItems.length; i += 4) {
        const chunk = inventoryItems.slice(i, i + 4)
        const lines = chunk.map((it) => ({
          stockItemId: it.id, quantity: rint(100, 300), rate: Math.round(it.rate * 0.72), discountPct: 0,
        }))
        const date = daysAgo(rint(Math.floor(config.days * 0.6), config.days))
        const res = await createPurchaseInvoiceAction({
          supplierId: pick(supIds), date, currencyCode: 'PKR', exchangeRate: 1,
          advancePaid: 0, locationId: txLocationId, lines,
        })
        if (res.success) { rec('purchase_invoice', res.data.invoiceId); summary.purchaseInvoices++ }
      }
    }

    // Sales spread across the recent half of the window (stock already exists).
    if (custIds.length > 0) {
      const saleCount = Math.min(Math.max(config.days, 3), 120)
      for (let k = 0; k < saleCount; k++) {
        const nLines = rint(1, 3)
        const lines = Array.from({ length: nLines }, () => {
          const it = pick(salePool)
          return { stockItemId: it.id, quantity: rint(1, 15), rate: it.rate, discountPct: pick([0, 0, 0, 5, 10]) }
        })
        const date = daysAgo(rint(0, Math.max(1, Math.floor(config.days * 0.5))))
        const res = await createSaleInvoiceAction({
          customerId: pick(custIds), date, currencyCode: 'PKR', exchangeRate: 1,
          locationId: txLocationId, allowOversell: true, dueDays: pick([0, 7, 15, 30]), lines,
        })
        if ('success' in res && res.success) { rec('sale_invoice', res.data.invoiceId); summary.saleInvoices++ }
      }
    }
  }

  // ── persist the batch footprint ──
  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500)
    await admin.from('demo_batch_rows').insert(
      slice.map((r) => ({ batch_id: batchId, tenant_id: tenantId, entity: r.entity, row_id: r.row_id })),
    )
  }
  await admin.from('demo_batches').update({ summary }).eq('id', batchId)

  return { batchId, summary, credentials }
}

// Safety net for the leftover SaaS-boilerplate rows (organizations / org_members
// / subscriptions) that used to be created on every signup and blocked
// auth.admin.deleteUser. Migration 0047 fixed the root cause (dropped the
// trigger + made those FKs ON DELETE CASCADE), so this is now belt-and-suspenders
// for any environment where 0047 hasn't been applied. Best-effort — tables may
// not exist everywhere.
async function clearAuthSideRows(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = admin as any
  try {
    const { data: orgs } = await raw.from('organizations').select('id').eq('owner_id', userId)
    const orgIds = (orgs ?? []).map((o: { id: string }) => o.id)
    if (orgIds.length > 0) await raw.from('subscriptions').delete().in('org_id', orgIds)
    await raw.from('org_members').delete().eq('user_id', userId)
    if (orgIds.length > 0) await raw.from('organizations').delete().in('id', orgIds)
  } catch {
    // Boilerplate tables absent — nothing to clean.
  }
}

// ── teardown ─────────────────────────────────────────────────────────────
export async function runRemoval(tenantId: string, batchId: string): Promise<{ removed: number }> {
  const admin = createAdminClient()

  const { data: batch } = await admin
    .from('demo_batches').select('id').eq('id', batchId).eq('tenant_id', tenantId).maybeSingle()
  if (!batch) throw new Error('Demo batch not found')

  const { data: rowData } = await admin
    .from('demo_batch_rows').select('entity, row_id').eq('batch_id', batchId).eq('tenant_id', tenantId)
  const byEntity = (e: string) => (rowData ?? []).filter((r) => r.entity === e).map((r) => r.row_id as string)

  let removed = 0

  const saleIds = byEntity('sale_invoice')
  const purchaseIds = byEntity('purchase_invoice')

  // Invoices first — their delete actions reverse GL + stock. Sales before
  // purchases so stock is returned before it's removed (never goes negative).
  for (const id of saleIds) {
    const res = await deleteSaleInvoiceAction({ invoiceId: id })
    if (res.success) removed++
  }
  for (const id of purchaseIds) {
    const res = await deletePurchaseInvoiceAction({ invoiceId: id })
    if (res.success) removed++
  }

  // Belt-and-suspenders GL purge: deletePurchaseInvoiceAction (unlike the sale
  // one) does NOT remove its journal entry. Those leftover lines reference
  // stock_item_id / supplier_id and would FK-block deleting the items and
  // suppliers below. Drop any journal entry still tied to this batch's invoices.
  const invoiceIds = [...saleIds, ...purchaseIds]
  if (invoiceIds.length > 0) {
    const { data: entries } = await admin
      .from('tajir_journal_entries').select('id').eq('tenant_id', tenantId).in('source_id', invoiceIds)
    const eids = (entries ?? []).map((e) => e.id as string)
    if (eids.length > 0) {
      await admin.from('tajir_journal_entry_lines').delete().in('journal_entry_id', eids)
      await admin.from('tajir_journal_entries').delete().in('id', eids).eq('tenant_id', tenantId)
    }
  }

  // Then master data, children before parents. The table name is dynamic, so
  // the query builder is loosely typed here (all these tables share id +
  // tenant_id, both scoped in the query below).
  type DemoTable = 'inventory_lots' | 'item_types' | 'employees' | 'suppliers' | 'tajir_customers' | 'locations'
  const del = async (table: DemoTable, ids: string[], col = 'id') => {
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q: any = admin.from(table).delete()
      const { error } = await q.in(col, slice).eq('tenant_id', tenantId)
      if (!error) removed += slice.length
    }
  }
  await del('inventory_lots', byEntity('item'))
  await del('item_types', byEntity('item_type'))
  await del('employees', byEntity('employee'))
  await del('suppliers', byEntity('supplier'))
  await del('tajir_customers', byEntity('customer'))
  await del('locations', byEntity('location'))

  // Users: unlink, clear boilerplate side-rows, then remove the auth account.
  for (const uid of byEntity('user')) {
    await admin.from('tenant_users').delete().eq('user_id', uid).eq('tenant_id', tenantId)
    await clearAuthSideRows(admin, uid)
    const { error } = await admin.auth.admin.deleteUser(uid)
    if (!error) removed++
  }

  await admin.from('demo_batch_rows').delete().eq('batch_id', batchId).eq('tenant_id', tenantId)
  await admin.from('demo_batches').update({ removed_at: new Date().toISOString() }).eq('id', batchId).eq('tenant_id', tenantId)

  return { removed }
}

// ── listing (for the "existing demo data" offer) ───────────────────────────
export async function listBatches(tenantId: string): Promise<DemoBatchInfo[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('demo_batches')
    .select('id, created_at, summary')
    .eq('tenant_id', tenantId)
    .is('removed_at', null)
    .order('created_at', { ascending: false })
  return (data ?? []).map((b) => ({
    id: b.id as string,
    createdAt: b.created_at as string,
    summary: (b.summary ?? {}) as DemoSummary,
  }))
}
