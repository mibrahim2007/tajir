import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchReportDefinition } from '@/lib/reports/custom-report'
import { ReportBuilder } from './report-builder'
import type { PickerAccount } from './account-multi-picker'

export default async function EditCustomReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role } = await requireAuth()
  const { id } = await params

  // Assistants can run a report but not change what it means.
  if (role !== 'owner') redirect(`/reports/custom/${id}`)

  const admin = createAdminClient()

  const [definition, { data: rawAccounts }] = await Promise.all([
    fetchReportDefinition({ admin, tenantId, reportId: id }),
    admin.from('chart_of_accounts')
      .select('code, name, account_type, parent_code, is_header')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('code'),
  ])

  if (!definition) notFound()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href={`/reports/custom/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Back to report
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Layout</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Order the lines, map account codes to each reporting header, and set how each one behaves.
          Nothing here changes your accounting data — figures are always read live from the general ledger.
        </p>
      </div>

      <ReportBuilder definition={definition} accounts={(rawAccounts ?? []) as PickerAccount[]} />
    </div>
  )
}
