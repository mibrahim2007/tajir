import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { type PdcRegisterRow } from '@/lib/pdc/sources'
import { OpeningChequeForm } from '../../../opening-cheque-form'
import { loadChequeFormOptions } from '../../cheque-form-options'

export default async function EditOpeningChequePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const admin = createAdminClient()
  const [{ data }, { parties, banks }] = await Promise.all([
    admin.from('pdc_register').select('*')
      .eq('tenant_id', tenantId).eq('source', 'pdc_opening').eq('line_id', id).maybeSingle(),
    loadChequeFormOptions(tenantId),
  ])

  // Once a cheque has been settled or handed on, other entries sit on top of
  // it — the edit action refuses it, and the list offers no edit.
  const r = data as PdcRegisterRow | null
  if (!r || r.pdc_status !== 'pending') notFound()

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Edit Opening Cheque</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A post-dated cheque that already existed before you started using Tajir.
          It is posted against Opening Balance Equity, so enter the party&rsquo;s own
          opening balance <strong>net of</strong> this cheque.
        </p>
      </div>
      <OpeningChequeForm
        banks={banks}
        parties={parties}
        today={today}
        cheque={{
          id:           r.line_id,
          direction:    r.direction,
          chequeNumber: r.cheque_number ?? '',
          dueDate:      r.cheque_due_date ?? '',
          asOfDate:     r.doc_date,
          amount:       Number(r.amount),
          partyKind:    r.party_kind,
          partyId:      r.party_id,
          partyName:    r.party_name,
          bankId:       r.bank_id,
        }}
      />
    </div>
  )
}
