import { supabase, SUPABASE_URL } from './supabase'
import type { Customer, Supplier, StockItem, LocationStock } from '../types'

// ── Auth header helper ───────────────────────────────────────────────────────
async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
}

async function callFunction(name: string, body: object) {
  const headers = await authHeader()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json
}

// ── Lookups (direct Supabase) ────────────────────────────────────────────────
export async function fetchCustomers(search = ''): Promise<Customer[]> {
  let q = supabase.from('tajir_customers').select('id, name').order('name').limit(100)
  if (search.trim()) q = q.ilike('name', `%${search}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Customer[]
}

export async function fetchSuppliers(search = ''): Promise<Supplier[]> {
  let q = supabase.from('suppliers').select('id, name').order('name').limit(100)
  if (search.trim()) q = q.ilike('name', `%${search}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Supplier[]
}

export async function fetchStockItems(search = ''): Promise<StockItem[]> {
  let q = supabase.from('inventory_lots').select('id, name, count, current_quantity').order('name').limit(100)
  if (search.trim()) q = q.ilike('name', `%${search}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as StockItem[]
}

export async function fetchLocationStock(stockItemId: string): Promise<LocationStock[]> {
  const { data, error } = await supabase
    .from('location_stock_summary')
    .select('location_id, quantity, locations(name)')
    .eq('stock_item_id', stockItemId)
    .gt('quantity', 0)
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    location_id:   r.location_id,
    location_name: r.locations?.name ?? 'Unknown',
    quantity:      parseFloat(r.quantity),
  }))
}

export async function fetchCustomerBalance(customerId: string) {
  const [sales, receipts, returns, creditNotes, refunds, customer] = await Promise.all([
    supabase.from('sales_orders').select('pkr_equivalent').eq('customer_id', customerId),
    supabase.from('ar_receipts').select('pkr_equivalent').eq('customer_id', customerId),
    supabase.from('sale_returns').select('pkr_equivalent').eq('customer_id', customerId),
    supabase.from('credit_notes').select('pkr_equivalent').eq('customer_id', customerId),
    supabase.from('customer_refunds').select('pkr_equivalent').eq('customer_id', customerId),
    supabase.from('tajir_customers').select('opening_balance_pkr_equivalent').eq('id', customerId).single(),
  ])

  const sum = (rows: any[] | null) =>
    (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.pkr_equivalent), 0)

  const opening  = parseFloat(customer.data?.opening_balance_pkr_equivalent ?? '0')
  const billed   = sum(sales.data)
  const received = sum(receipts.data)
  const returned = sum(returns.data)
  const credited = sum(creditNotes.data)
  const refunded = sum(refunds.data)

  return opening + billed - received - returned - credited + refunded
}

export async function fetchRecentSales(customerId: string) {
  const { data } = await supabase
    .from('sales_orders')
    .select('id, date, pkr_equivalent, quantity, rate')
    .eq('customer_id', customerId)
    .order('date', { ascending: false })
    .limit(5)
  return data ?? []
}

// ── Transactions (Edge Functions) ─────────────────────────────────────────────
export const createSale = (p: {
  customerId: string; stockItemId: string; quantity: number; rate: number; date: string
}) => callFunction('quick-sale', p)

export const createSaleReturn = (p: {
  customerId: string; stockItemId: string; quantity: number; rate: number; date: string; reason?: string
}) => callFunction('quick-sale-return', p)

export const createPurchase = (p: {
  supplierId: string; stockItemId: string; quantity: number; rate: number; date: string
}) => callFunction('quick-purchase', p)

export const createReceipt = (p: {
  customerId: string; amount: number; date: string; notes?: string
}) => callFunction('quick-receipt', p)

export const createPayment = (p: {
  supplierId: string; amount: number; date: string; notes?: string
}) => callFunction('quick-payment', p)
