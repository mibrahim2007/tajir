import { requireAuth } from '@/lib/auth/require-auth'
import { AgentForm } from '../agent-form'

export default async function NewAgentPage() {
  const { role } = await requireAuth()
  // Commission terms and the payable behind them are owner-only.
  if (role !== 'owner') {
    return <div className="p-6"><p className="text-muted-foreground">Access denied.</p></div>
  }

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Enrol Agent</h1>
        <p className="text-sm text-muted-foreground mt-1">A broker who introduces trade. Commission accrues automatically on every invoice they are named on, and is paid out from their ledger.</p>
      </div>
      <AgentForm />
    </div>
  )
}
