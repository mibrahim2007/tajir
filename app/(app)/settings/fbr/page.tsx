import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPKTDateTime } from '@/lib/utils/dates'
import { applicableScenarios, scenarioById, FALLBACK_PROVINCES } from '@/lib/fbr/scenarios'
import { FbrSettingsForm } from './fbr-settings-form'

export default async function FbrSettingsPage() {
  const { role, tenantId } = await requireAuth()
  if (role !== 'owner') redirect('/dashboard')

  const admin = createAdminClient()
  const [{ data: settings }, { data: cred }, { data: tenant }, { data: posted }] = await Promise.all([
    admin.from('fbr_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
    admin.from('fbr_credentials').select('token_last4, updated_at').eq('tenant_id', tenantId).eq('environment', 'sandbox').maybeSingle(),
    admin.from('tenants').select('name, ntn').eq('id', tenantId).maybeSingle(),
    admin.from('fbr_invoices').select('scenario_id').eq('tenant_id', tenantId).eq('environment', 'sandbox').eq('status', 'posted'),
  ])

  const cache = (settings?.reference_cache ?? null) as { provinces?: string[] } | null
  const provinces = cache?.provinces?.length ? cache.provinces : FALLBACK_PROVINCES
  const required = applicableScenarios(settings?.business_activity ?? null, settings?.sector ?? null)
  const passed = new Set((posted ?? []).map((p) => p.scenario_id))
  const passedCount = required.filter((id) => passed.has(id)).length

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold tracking-tight">FBR Digital Invoicing</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Post sales tax invoices to FBR through PRAL. Start in the <strong>sandbox</strong>: enter your seller details and
        sandbox token, test the connection, then raise tax invoices to registered or unregistered buyers.
      </p>

      <div className="mt-6">
        <FbrSettingsForm
          initial={{
            enabled:            settings?.enabled ?? false,
            sellerNtnCnic:      settings?.seller_ntn_cnic ?? (tenant as { ntn?: string | null } | null)?.ntn ?? '',
            sellerBusinessName: settings?.seller_business_name ?? tenant?.name ?? '',
            sellerProvince:     settings?.seller_province ?? '',
            sellerAddress:      settings?.seller_address ?? '',
            businessActivity:   settings?.business_activity ?? '',
            sector:             settings?.sector ?? '',
            furtherTaxRate:     Number(settings?.further_tax_rate ?? 4),
          }}
          provinces={provinces}
          tokenLast4={cred?.token_last4 ?? null}
          lastTest={settings?.last_test_at ? {
            ok: !!settings.last_test_ok,
            message: settings.last_test_message ?? '',
            at: formatPKTDateTime(settings.last_test_at),
          } : null}
        />
      </div>

      {/* ── Sandbox scenario progress ── */}
      <section className="mt-8 bg-card rounded-2xl border shadow-sm px-4 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">Sandbox scenarios</h2>
          {required.length > 0 && (
            <span className="text-sm text-muted-foreground">{passedCount} of {required.length} posted</span>
          )}
        </div>
        {required.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">Choose your business activity and sector above to see the scenarios FBR requires.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mt-1">
              FBR asks each taxpayer to post a sandbox invoice for every scenario that applies to their business before production is opened.
            </p>
            <ul className="mt-3 divide-y text-sm">
              {required.map((id) => (
                <li key={id} className="flex items-center gap-3 py-2">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    passed.has(id) ? 'bg-emerald-600 text-white' : 'border text-muted-foreground'}`}>
                    {passed.has(id) ? '✓' : ''}
                  </span>
                  <span className="font-mono text-xs w-14">{id}</span>
                  <span className="flex-1">{scenarioById(id)?.description ?? id}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="mt-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-2 text-muted-foreground">
        <p className="font-medium text-foreground">Before the first call</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>In IRIS (iris.fbr.gov.pk) open <em>Digital Invoicing</em> and register this software, giving the server IP shown above.</li>
          <li>Copy the <em>sandbox</em> token PRAL issues and paste it here, then press <em>Test connection</em>.</li>
          <li>Raise and post one sandbox invoice for each scenario in the list. Production is enabled after that.</li>
        </ol>
        <p>The token is stored encrypted and is only ever used from this server.</p>
      </div>
    </div>
  )
}
