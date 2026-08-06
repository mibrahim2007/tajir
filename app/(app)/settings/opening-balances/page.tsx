import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKTDate } from '@/lib/utils/dates'
import { type PdcRegisterRow } from '@/lib/pdc/sources'
import { StockBalanceTable, type OpeningLot } from './stock-balance-table'
import { CustomerBalanceTable } from './customer-balance-table'
import { SupplierBalanceTable } from './supplier-balance-table'
import { OpeningChequesTable, type OpeningChequeRow, type PartyOption } from './opening-cheques-table'

export default async function OpeningBalancesPage() {
  const { tenantId, role } = await requireAuth()

  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: rawLots },
    { data: rawCustomers },
    { data: rawSuppliers },
    { data: rawLocations },
    { data: rawCheques },
    { data: rawBanks },
    { data: rawOpeningStock },
  ] = await Promise.all([
    admin.from('inventory_lots').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('tajir_customers').select('id, name, opening_balance, opening_balance_currency, opening_balance_pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('suppliers').select('id, name, opening_balance, opening_balance_currency, opening_balance_pkr_equivalent').eq('tenant_id', tenantId),
    admin.from('locations').select('id, name').eq('tenant_id', tenantId),
    admin.from('pdc_register').select('*').eq('tenant_id', tenantId).eq('source', 'pdc_opening'),
    admin.from('banks').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('stock_opening_balances').select('stock_item_id, location_id, quantity, rate').eq('tenant_id', tenantId),
  ])

  const locations = (rawLocations ?? []).map((l) => ({ id: l.id, name: l.name }))
  const locationNames = new Map(locations.map((l) => [l.id, l.name]))

  const num = (v: unknown) => parseFloat(String(v ?? '0')) || 0

  // Opening stock is per (item, location); group it under its item so each row
  // can list every warehouse the item was loaded at.
  const linesByLot = new Map<string, OpeningLot['lines']>()
  for (const row of rawOpeningStock ?? []) {
    const lines = linesByLot.get(row.stock_item_id) ?? []
    lines.push({
      locationId:   row.location_id,
      locationName: locationNames.get(row.location_id) ?? '—',
      quantity:     num(row.quantity),
      rate:         num(row.rate),
    })
    linesByLot.set(row.stock_item_id, lines)
  }

  const lots: OpeningLot[] = (rawLots ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    lines: (linesByLot.get(l.id) ?? []).sort((a, b) => a.locationName.localeCompare(b.locationName)),
  }))

  const customers = (rawCustomers ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    openingBalance: c.opening_balance,
    openingBalanceCurrency: c.opening_balance_currency,
    openingBalancePkrEquivalent: c.opening_balance_pkr_equivalent,
  }))

  const allSuppliers = (rawSuppliers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    openingBalance: s.opening_balance,
    openingBalanceCurrency: s.opening_balance_currency,
    openingBalancePkrEquivalent: s.opening_balance_pkr_equivalent,
  }))

  const banks = (rawBanks ?? []).map((b) => ({ id: b.id, name: b.name }))
  const bankNames = new Map(banks.map((b) => [b.id, b.name]))

  // Both party lists in one picker; the value carries the kind so the action
  // knows which subledger a bounce would move.
  const parties: PartyOption[] = [
    ...(rawCustomers ?? []).map((c) => ({ kind: 'customer' as const, id: c.id, name: c.name })),
    ...(rawSuppliers ?? []).map((s) => ({ kind: 'supplier' as const, id: s.id, name: s.name })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  // Dates are formatted here rather than in the client table: doing it there
  // made the server and client markup differ and left the buttons inert.
  const cheques: OpeningChequeRow[] = ((rawCheques ?? []) as PdcRegisterRow[])
    .sort((a, b) => (a.cheque_due_date ?? '').localeCompare(b.cheque_due_date ?? ''))
    .map((r) => ({
      id:           r.line_id,
      serial:       r.doc_serial,
      chequeNumber: r.cheque_number ?? '',
      dueDate:      r.cheque_due_date ?? '',
      dueLabel:     r.cheque_due_date ? formatPKTDate(r.cheque_due_date + 'T00:00:00') : '—',
      asOfDate:     r.doc_date,
      amount:       Number(r.amount),
      direction:    r.direction,
      partyKind:    r.party_kind,
      partyId:      r.party_id,
      partyName:    r.party_name,
      bankId:       r.bank_id,
      bankName:     r.bank_id ? bankNames.get(r.bank_id) ?? null : null,
      status:       r.pdc_status,
      overdue:      r.pdc_status === 'pending' && !!r.cheque_due_date && r.cheque_due_date < today,
    }))

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Opening Balances</h1>
        <p className="text-sm text-muted-foreground mt-1">Set quantities and outstanding balances to bring your current business state into Tajir. Changes are saved immediately and reflected across all reports.</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Stock Item Quantities</h2>
        <p className="text-sm text-muted-foreground mb-3">An item held in more than one warehouse can be loaded at all of them at once — add a line per location.</p>
        <StockBalanceTable lots={lots} locations={locations} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Customer Opening Balances</h2>
        <CustomerBalanceTable customers={customers} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Supplier Opening Balances</h2>
        <SupplierBalanceTable suppliers={allSuppliers} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Post-Dated Cheques</h2>
        <OpeningChequesTable cheques={cheques} banks={banks} parties={parties} today={today} />
      </section>
    </div>
  )
}
