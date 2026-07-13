import { createAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/auth/get-tenant'
import { formatPKTDateTime } from '@/lib/utils/dates'

export type SaleInvoiceLine = {
  id: string
  name: string
  uom: string | null
  qty: number
  rate: number
  amount: number
  /** True when the selling rate is below the latest known purchase cost. Internal use only. */
  belowCost: boolean
  cost: number | null
}

export type SaleInvoiceData = {
  docId: string
  tenantId: string
  tenant: { name: string; ntn: string | null }
  voucherNo: string
  serialNumber: string | null
  customerName: string
  customerPhone: string | null
  date: string
  entryTime: string
  paymentDueDate: string | null
  currencyCode: string
  exchangeRate: number
  isUSD: boolean
  notes: string | null
  lines: SaleInvoiceLine[]
  totalPKR: number
}

const LINE_COLUMNS =
  'id, tenant_id, serial_number, date, created_at, quantity, rate, currency_code, exchange_rate, pkr_equivalent, payment_due_date, customer_id, stock_item_id, notes'

type LineRow = {
  id: string
  tenant_id: string
  serial_number: string | null
  date: string
  created_at: string
  quantity: number
  rate: number
  currency_code: string
  exchange_rate: number
  pkr_equivalent: number
  payment_due_date: string | null
  customer_id: string
  stock_item_id: string
  notes: string | null
}

type LoadOptions = { includeCostWarnings?: boolean }

/**
 * Loads a grouped sale invoice (many lines sharing an invoice_id).
 * See buildSaleDoc for the `includeCostWarnings` caveat. Returns null when no
 * invoice matches.
 */
export async function loadSaleInvoice(invoiceId: string, opts: LoadOptions = {}): Promise<SaleInvoiceData | null> {
  const admin = createAdminClient()
  const { data: lines } = await admin
    .from('sales_orders')
    .select(LINE_COLUMNS)
    .eq('invoice_id', invoiceId)
    .order('created_at')

  if (!lines || lines.length === 0) return null
  return buildSaleDoc(lines as LineRow[], invoiceId, { voucherSourceType: 'sale_invoice', voucherPrefix: 'SI', ...opts })
}

/**
 * Loads a solo sale order (a single sales_orders row, no invoice_id), rendered
 * as a one-line invoice. Returns null when no order matches.
 */
export async function loadSaleOrder(orderId: string, opts: LoadOptions = {}): Promise<SaleInvoiceData | null> {
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('sales_orders')
    .select(LINE_COLUMNS)
    .eq('id', orderId)
    .single()

  if (!order) return null
  return buildSaleDoc([order as LineRow], orderId, { voucherSourceType: 'sale_order', voucherPrefix: 'SO', ...opts })
}

/**
 * Shared assembly for both grouped invoices and solo orders.
 *
 * `includeCostWarnings` runs the extra purchase-cost lookup used to flag
 * below-cost lines. Keep it OFF for customer-facing (public) rendering —
 * margin data must never leak to the buyer.
 */
async function buildSaleDoc(
  lines: LineRow[],
  docId: string,
  { voucherSourceType, voucherPrefix, includeCostWarnings = false }:
    { voucherSourceType: string; voucherPrefix: string; includeCostWarnings?: boolean },
): Promise<SaleInvoiceData> {
  const admin = createAdminClient()
  const first = lines[0]
  const tenantId = first.tenant_id
  const stockIds = [...new Set(lines.map((l) => l.stock_item_id))]
  const customerIds = [...new Set(lines.map((l) => l.customer_id))]

  const [tenant, { data: stockItems }, { data: customers }, { data: journalEntry }] = await Promise.all([
    getTenant(tenantId),
    admin.from('inventory_lots').select('id, name, unit_of_measure').in('id', stockIds),
    admin.from('tajir_customers').select('id, name, phone').in('id', customerIds),
    admin.from('tajir_journal_entries')
      .select('voucher_number')
      .eq('source_id', docId)
      .eq('source_type', voucherSourceType)
      .single(),
  ])

  const stockMap = new Map((stockItems ?? []).map((s) => [s.id, { name: s.name, uom: s.unit_of_measure ?? null }]))
  const customer = (customers ?? []).find((c) => c.id === first.customer_id) ?? null

  // Latest cost per stock item — only when flagging below-cost lines (internal).
  const costMap: Record<string, number> = {}
  if (includeCostWarnings) {
    const { data: rawPurchases } = await admin
      .from('purchase_orders')
      .select('stock_item_id, pkr_equivalent, quantity')
      .eq('tenant_id', tenantId)
      .in('stock_item_id', stockIds)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    for (const p of rawPurchases ?? []) {
      if (!costMap[p.stock_item_id]) costMap[p.stock_item_id] = p.pkr_equivalent / p.quantity
    }
  }

  const er = first.exchange_rate
  const invoiceLines: SaleInvoiceLine[] = lines.map((line) => {
    const cost = costMap[line.stock_item_id]
    const ratePKR = line.rate * er
    return {
      id: line.id,
      name: stockMap.get(line.stock_item_id)?.name ?? '—',
      uom: stockMap.get(line.stock_item_id)?.uom ?? null,
      qty: line.quantity,
      rate: line.rate,
      amount: line.pkr_equivalent,
      belowCost: cost !== undefined && ratePKR < cost,
      cost: cost ?? null,
    }
  })

  return {
    docId,
    tenantId,
    tenant: { name: tenant.name, ntn: tenant.ntn },
    voucherNo: journalEntry?.voucher_number ?? `${voucherPrefix}-${docId.slice(-6).toUpperCase()}`,
    serialNumber: first.serial_number ?? null,
    customerName: customer?.name ?? '—',
    customerPhone: customer?.phone ?? null,
    date: first.date,
    entryTime: formatPKTDateTime(new Date(first.created_at)).split(', ')[1],
    paymentDueDate: first.payment_due_date ?? null,
    currencyCode: first.currency_code,
    exchangeRate: er,
    isUSD: first.currency_code === 'USD',
    notes: lines.find((l) => l.notes && l.notes.trim())?.notes?.trim() ?? null,
    lines: invoiceLines,
    totalPKR: lines.reduce((s, l) => s + l.pkr_equivalent, 0),
  }
}
