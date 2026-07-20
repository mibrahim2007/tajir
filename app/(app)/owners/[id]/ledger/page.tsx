import { notFound } from 'next/navigation'
import { PendingChequesPanel } from "@/components/pending-cheques-panel"
import Link from 'next/link'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { peekNextDocumentSerial } from '@/lib/serials/next-serial'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'
import { OwnerTransactionForm } from '../../owner-transaction-form'
import { OwnerLedgerRows } from './owner-ledger-rows'

export default async function OwnerLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await requireAuth()
  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: owner } = await admin
    .from('owners')
    .select('id, name, cnic, phone, profit_share_pct, is_active')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!owner) notFound()

  const [{ data: allTxns }, { data: allBanks }] = await Promise.all([
    admin.from('owner_transactions')
      .select('id, serial_number, txn_type, amount, currency_code, exchange_rate, pkr_equivalent, date, notes')
      .eq('tenant_id', tenantId).eq('owner_id', id)
      .order('date', { ascending: true }).order('created_at', { ascending: true }),
    admin.from('banks').select('id, name, account_number').eq('tenant_id', tenantId).order('name'),
  ])

  const txns = allTxns ?? []
  const banks = allBanks ?? []
  const nextSerial = await peekNextDocumentSerial(admin, tenantId, 'owner_withdrawal', today)

  // Running net capital, oldest first: contributions add, drawings subtract.
  let running = 0
  const rows = txns.map((t) => {
    const isContribution = t.txn_type === 'contribution'
    running += isContribution ? t.pkr_equivalent : -t.pkr_equivalent
    return {
      id: t.id,
      serialNumber: t.serial_number as string | null,
      date: t.date as string,
      dateLabel: formatPKTDate(new Date(t.date)),
      txnType: t.txn_type as 'withdrawal' | 'contribution',
      contributed: isContribution ? t.pkr_equivalent : 0,
      drawn: isContribution ? 0 : t.pkr_equivalent,
      balance: running,
      currencyCode: t.currency_code as string,
      amount: Number(t.amount),
      notes: t.notes as string | null,
    }
  })

  const contributed = txns.filter((t) => t.txn_type === 'contribution').reduce((s, t) => s + t.pkr_equivalent, 0)
  const drawn = txns.filter((t) => t.txn_type === 'withdrawal').reduce((s, t) => s + t.pkr_equivalent, 0)
  const net = contributed - drawn

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PendingChequesPanel direction="out" className="mb-4" />
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <Link href="/owners" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
            ← Owners
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">{owner.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capital &amp; drawings ledger
            {Number(owner.profit_share_pct) > 0 && ` · ${Number(owner.profit_share_pct).toFixed(2)}% share`}
          </p>
        </div>
        <OwnerTransactionForm ownerId={owner.id} today={today} nextSerial={nextSerial} banks={banks} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-2xl border shadow-sm px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Capital In</p>
          <p className="text-xl font-extrabold tabular-nums mt-1">{formatPKR(contributed)}</p>
        </div>
        <div className="bg-card rounded-2xl border shadow-sm px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Drawings</p>
          <p className="text-xl font-extrabold tabular-nums mt-1 text-amber-600 dark:text-amber-400">{formatPKR(drawn)}</p>
        </div>
        <div className="bg-card rounded-2xl border shadow-sm px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Net Capital</p>
          <p className={`text-xl font-extrabold tabular-nums mt-1 ${net < 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>
            {formatPKR(net)}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed py-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            No capital movements recorded for {owner.name} yet.
          </p>
        </div>
      ) : (
        <OwnerLedgerRows rows={rows} />
      )}
    </div>
  )
}
