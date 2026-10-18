import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { Button } from '@/components/ui/button'
import { FbrStatusBadge } from './status-badge'

export default async function FbrInvoicesPage() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()
  const { data: settings } = await admin.from('fbr_settings').select('enabled, environment').eq('tenant_id', tenantId).maybeSingle()
  if (!settings?.enabled) redirect(role === 'owner' ? '/settings/fbr' : '/dashboard')

  const { data: invoices } = await admin.from('fbr_invoices')
    .select('id, serial_number, invoice_type, invoice_date, buyer_registration_type, buyer_business_name, scenario_id, total_amount, total_sales_tax, status, fbr_invoice_number, environment')
    .eq('tenant_id', tenantId)
    .order('invoice_date', { ascending: false }).order('created_at', { ascending: false })
    .limit(300)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">FBR Tax Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sales tax invoices posted to FBR Digital Invoicing ·{' '}
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {settings.environment === 'sandbox' ? 'Sandbox' : 'Production'}
            </span>
          </p>
        </div>
        <Button asChild className="min-h-[44px]"><Link href="/fbr-invoices/new">+ New tax invoice</Link></Button>
      </div>

      {!invoices?.length ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No FBR tax invoices yet. <Link href="/fbr-invoices/new" className="text-primary hover:underline">Create the first one</Link>.
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">No.</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Buyer</th>
                <th className="text-left px-4 py-3 font-medium">Scenario</th>
                <th className="text-right px-4 py-3 font-medium">Sales tax</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">FBR invoice no.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((i) => (
                <tr key={i.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link href={`/fbr-invoices/${i.id}`} className="font-mono text-primary hover:underline">{i.serial_number ?? '—'}</Link>
                    {i.invoice_type === 'Debit Note' && <span className="block text-xs text-muted-foreground">Debit Note</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatPKTDate(i.invoice_date + 'T00:00:00')}</td>
                  <td className="px-4 py-2.5">
                    {i.buyer_business_name}
                    <span className="block text-xs text-muted-foreground">{i.buyer_registration_type}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{i.scenario_id}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatPKR(Number(i.total_sales_tax))}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatPKR(Number(i.total_amount))}</td>
                  <td className="px-4 py-2.5"><FbrStatusBadge status={i.status} /></td>
                  <td className="px-4 py-2.5 font-mono text-xs">{i.fbr_invoice_number ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
