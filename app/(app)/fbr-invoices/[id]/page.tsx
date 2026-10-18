import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate, formatPKTDateTime } from '@/lib/utils/dates'
import { scenarioById } from '@/lib/fbr/scenarios'
import { FbrStatusBadge } from '../status-badge'
import { FbrInvoiceActions } from './fbr-invoice-actions'

export default async function FbrInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const [{ data: inv }, { data: items }] = await Promise.all([
    admin.from('fbr_invoices').select('*').eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('fbr_invoice_items').select('*').eq('invoice_id', id).eq('tenant_id', tenantId).order('line_no'),
  ])
  if (!inv) notFound()
  const locked = inv.status === 'posted' || inv.status === 'posting'

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/fbr-invoices" className="text-sm text-muted-foreground hover:underline">← FBR Tax Invoices</Link>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1 flex items-center gap-3">
            {inv.serial_number ?? 'FBR Tax Invoice'} <FbrStatusBadge status={inv.status} />
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {inv.invoice_type} · {formatPKTDate(inv.invoice_date + 'T00:00:00')} · {inv.environment === 'sandbox' ? 'Sandbox' : 'Production'}
            {inv.scenario_id && <> · {inv.scenario_id} {scenarioById(inv.scenario_id)?.description}</>}
          </p>
        </div>
        <FbrInvoiceActions id={inv.id} locked={locked} />
      </div>

      {inv.fbr_invoice_number && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">FBR invoice number</p>
          <p className="text-xl font-extrabold font-mono mt-0.5 break-all">{inv.fbr_invoice_number}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Posted {inv.posted_at ? formatPKTDateTime(inv.posted_at) : ''}{inv.fbr_dated ? ` · FBR time ${inv.fbr_dated}` : ''} — locked; corrections go on a Debit Note.
          </p>
        </div>
      )}

      {inv.last_error && !locked && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-900/50 dark:bg-red-950/30">
          <p className="font-semibold text-red-700 dark:text-red-400">FBR response</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            {inv.last_error.split('\n').map((e, i) => <li key={i}>{e}</li>)}
          </ul>
          {inv.status === 'failed' && (
            <p className="text-xs text-muted-foreground mt-2">
              The call did not complete. Before posting again, check FBR’s portal that it was not recorded.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border px-4 py-3 text-sm space-y-0.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Buyer — {inv.buyer_registration_type}</p>
          <p className="font-semibold">{inv.buyer_business_name}</p>
          <p className="text-muted-foreground">NTN/CNIC: {inv.buyer_ntn_cnic || '—'}</p>
          <p className="text-muted-foreground">{inv.buyer_address}, {inv.buyer_province}</p>
          {inv.invoice_ref_no && <p className="text-muted-foreground">Against FBR invoice <span className="font-mono">{inv.invoice_ref_no}</span></p>}
        </div>
        <div className="bg-card rounded-2xl border px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Value excl. sales tax</span><span className="tabular-nums">{formatPKR(Number(inv.total_value_excl_st))}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Sales tax</span><span className="tabular-nums">{formatPKR(Number(inv.total_sales_tax))}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Further tax</span><span className="tabular-nums">{formatPKR(Number(inv.total_further_tax))}</span></div>
          <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span className="tabular-nums">{formatPKR(Number(inv.total_amount))}</span></div>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium">#</th>
              <th className="text-left px-3 py-2.5 font-medium">HS code · Description</th>
              <th className="text-right px-3 py-2.5 font-medium">Qty</th>
              <th className="text-right px-3 py-2.5 font-medium">Value excl. ST</th>
              <th className="text-right px-3 py-2.5 font-medium">Rate</th>
              <th className="text-right px-3 py-2.5 font-medium">Sales tax</th>
              <th className="text-right px-3 py-2.5 font-medium">Further tax</th>
              <th className="text-right px-3 py-2.5 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(items ?? []).map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2.5 text-muted-foreground">{i.line_no}</td>
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs">{i.hs_code}</span> · {i.product_description}
                  <span className="block text-xs text-muted-foreground">{i.sale_type}{i.fbr_item_invoice_no ? ` · ${i.fbr_item_invoice_no}` : ''}</span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{Number(i.quantity)} {i.uom}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatPKR(Number(i.value_sales_excluding_st))}</td>
                <td className="px-3 py-2.5 text-right">{i.rate}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatPKR(Number(i.sales_tax_applicable))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatPKR(Number(i.further_tax))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium">{formatPKR(Number(i.total_values))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inv.last_request && (
        <details className="rounded-lg border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Data sent to FBR (last call)</summary>
          <pre className="mt-2 overflow-x-auto text-xs bg-muted/40 rounded p-3">{JSON.stringify(inv.last_request, null, 2)}</pre>
          {inv.last_response && (
            <>
              <p className="mt-3 font-medium">FBR response</p>
              <pre className="mt-1 overflow-x-auto text-xs bg-muted/40 rounded p-3">{JSON.stringify(inv.last_response, null, 2)}</pre>
            </>
          )}
        </details>
      )}
    </div>
  )
}
