import { requireAuth } from '@/lib/auth/require-auth'
import { OpeningChequeForm } from '../../opening-cheque-form'
import { loadChequeFormOptions } from '../cheque-form-options'

export default async function NewOpeningChequePage() {
  const { tenantId, role } = await requireAuth()
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  const { parties, banks } = await loadChequeFormOptions(tenantId)
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Load Opening Cheque</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A post-dated cheque that already existed before you started using Tajir.
          It is posted against Opening Balance Equity, so enter the party&rsquo;s own
          opening balance <strong>net of</strong> this cheque.
        </p>
      </div>
      <OpeningChequeForm banks={banks} parties={parties} today={today} />
    </div>
  )
}
