export const runtime = 'nodejs'

import { requireAuthRoute } from '@/lib/auth/require-auth-route'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildConsolidatedLedger } from '@/lib/ledger/consolidated'

// Quote a CSV field only when it contains a comma, quote, or newline.
function csvField(value: string | number): string {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2)

export async function GET(_req: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const auth = await requireAuthRoute()
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { tenantId, role } = auth
  if (role !== 'owner') return new Response('Forbidden', { status: 403 })

  const { linkId } = await params
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('party_links')
    .select('customer_id, supplier_id')
    .eq('id', linkId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!link) return new Response('Not Found', { status: 404 })

  const { data: customer } = await admin
    .from('tajir_customers')
    .select('name')
    .eq('id', link.customer_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const { rows, customerBalance, supplierBalance, netBalance } = await buildConsolidatedLedger(
    tenantId,
    link.customer_id,
    link.supplier_id,
  )

  const lines: string[] = []
  lines.push(['Date', 'Description', 'Source', 'Debit (PKR)', 'Credit (PKR)', 'Balance (PKR)'].map(csvField).join(','))
  for (const r of rows) {
    lines.push([
      r.date,
      r.description,
      r.side === 'customer' ? 'Customer' : 'Supplier',
      r.debit > 0 ? money(r.debit) : '',
      r.credit > 0 ? money(r.credit) : '',
      money(r.balance),
    ].map(csvField).join(','))
  }
  // Summary footer.
  lines.push('')
  lines.push([csvField('As Customer (Receivable)'), '', '', '', '', money(customerBalance)].join(','))
  lines.push([csvField('As Supplier (Payable)'), '', '', '', '', money(supplierBalance)].join(','))
  lines.push([csvField('Net Balance'), '', '', '', '', money(netBalance)].join(','))

  // Prepend a UTF-8 BOM so Excel opens PKR text and non-ASCII names correctly.
  const csv = '﻿' + lines.join('\r\n')
  const safeName = (customer?.name ?? 'party').replace(/[^a-zA-Z0-9_-]/g, '_')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}-consolidated-ledger.csv"`,
    },
  })
}
