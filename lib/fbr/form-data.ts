import 'server-only'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { applicableScenarios, FALLBACK_PROVINCES, FALLBACK_UOMS, type BuyerType } from './scenarios'
import type { FbrBuyerPreset } from '@/app/(app)/fbr-invoices/fbr-invoice-form'

/** Everything the FBR invoice form needs; sends the user to setup if FBR is off. */
export async function loadFbrFormData() {
  const { tenantId, role } = await requireAuth()
  const admin = createAdminClient()
  const { data: settings } = await admin.from('fbr_settings').select('*').eq('tenant_id', tenantId).maybeSingle()
  if (!settings?.enabled) redirect(role === 'owner' ? '/settings/fbr' : '/dashboard')

  const [{ data: customers }, { data: recent }] = await Promise.all([
    admin.from('tajir_customers').select('id, name').eq('tenant_id', tenantId).order('name'),
    admin.from('fbr_invoices')
      .select('customer_id, buyer_registration_type, buyer_ntn_cnic, buyer_province, buyer_address, created_at')
      .eq('tenant_id', tenantId).not('customer_id', 'is', null)
      .order('created_at', { ascending: false }).limit(1000),
  ])

  // A customer's buyer details are remembered from their latest FBR invoice.
  const last = new Map<string, FbrBuyerPreset['last']>()
  for (const r of recent ?? []) {
    if (r.customer_id && !last.has(r.customer_id)) {
      last.set(r.customer_id, {
        type: r.buyer_registration_type as BuyerType, ntn: r.buyer_ntn_cnic ?? '', province: r.buyer_province, address: r.buyer_address,
      })
    }
  }

  const cache = (settings.reference_cache ?? null) as { provinces?: string[]; uoms?: string[] } | null
  return {
    tenantId,
    settings,
    customers: (customers ?? []).map((c) => ({ id: c.id, name: c.name, last: last.get(c.id) })) as FbrBuyerPreset[],
    provinces: cache?.provinces?.length ? cache.provinces : FALLBACK_PROVINCES,
    uoms: cache?.uoms?.length ? cache.uoms : FALLBACK_UOMS,
    applicable: applicableScenarios(settings.business_activity, settings.sector),
    furtherTaxRate: Number(settings.further_tax_rate),
  }
}
