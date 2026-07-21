'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatPKR } from '@/lib/utils/currency'
import { PDC_SOURCES, type PdcRegisterRow } from '@/lib/pdc/sources'
import { settlePdcAction } from '@/app/actions/settle-pdc'

type Bank = { id: string; name: string; account_number: string | null }

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  cleared: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  bounced: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  endorsed: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400',
}

export function PdcRegisterTable({
  rows, banks, today, canSettle,
}: {
  rows: (PdcRegisterRow & { dueLabel: string | null; overdue: boolean })[]
  banks: Bank[]
  today: string
  canSettle: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [openId, setOpenId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<'cleared' | 'bounced'>('cleared')
  const [date, setDate] = useState(today)
  const [moneyAccount, setMoneyAccount] = useState<'cash_at_bank' | 'cash_in_hand'>('cash_at_bank')
  const [bankId, setBankId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  type Row = (typeof rows)[number]
  const open = (r: Row) => {
    setOpenId(`${r.source}-${r.line_id}`)
    // A handed-on cheque can only bounce, so don't open on an outcome the
    // server will refuse.
    setOutcome(r.pdc_status === 'endorsed' ? 'bounced' : 'cleared')
    setDate(today)
    setMoneyAccount('cash_at_bank')
    setBankId(r.bank_id ?? '')
    setError(null)
  }

  const submit = (r: Row) => {
    startTransition(async () => {
      setError(null)
      const result = await settlePdcAction({
        source: r.source, lineId: r.line_id, outcome, date,
        moneyAccount, bankId: bankId || undefined,
      })
      if (!result.success) { setError(result.error); return }
      setOpenId(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="bg-card rounded-2xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cheque</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Party</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Source</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Due</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-3 print:hidden" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const key = `${r.source}-${r.line_id}`
              return (
                <tr key={key} className="hover:bg-secondary/50 align-top">
                  <td className="px-4 py-3 font-mono text-xs">{r.cheque_number ?? '—'}</td>
                  <td className="px-4 py-3">
                    {r.party_name ?? '—'}
                    <span className="block text-xs text-muted-foreground">
                      {r.direction === 'in' ? 'Received' : 'Issued'} · {r.doc_serial ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{PDC_SOURCES[r.source].label}</td>
                  <td className={`px-4 py-3 whitespace-nowrap ${r.overdue ? 'text-destructive font-medium' : ''}`}>
                    {r.dueLabel ?? '—'}
                    {r.overdue && <span className="block text-xs">overdue</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPKR(Number(r.amount))}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[r.pdc_status]}`}>
                      {r.pdc_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right print:hidden">
                    {(r.pdc_status === 'pending' || r.pdc_status === 'endorsed') && canSettle && (
                      openId === key ? (
                        <div className="flex flex-col gap-2 items-end min-w-[220px]">
                          {/* A handed-on cheque is not ours to bank, so bouncing
                              is the only outcome left for it. */}
                          {r.pdc_status === 'endorsed' ? (
                            <p className="text-xs text-muted-foreground text-right">
                              Handed on — bouncing re-owes both parties
                            </p>
                          ) : (
                            <Select value={outcome} onValueChange={(v) => setOutcome(v as 'cleared' | 'bounced')}>
                              <SelectTrigger className="min-h-[36px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cleared">Cleared — funds moved</SelectItem>
                                <SelectItem value="bounced">Bounced — cheque failed</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-[36px]" />
                          {outcome === 'cleared' && r.pdc_status !== 'endorsed' && (
                            <>
                              <Select value={moneyAccount} onValueChange={(v) => setMoneyAccount(v as 'cash_at_bank' | 'cash_in_hand')}>
                                <SelectTrigger className="min-h-[36px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cash_at_bank">Cash at Bank</SelectItem>
                                  <SelectItem value="cash_in_hand">Cash in Hand</SelectItem>
                                </SelectContent>
                              </Select>
                              {banks.length > 0 && (
                                <Select value={bankId || '__none__'} onValueChange={(v) => setBankId(v === '__none__' ? '' : v)}>
                                  <SelectTrigger className="min-h-[36px]"><SelectValue placeholder="Bank" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">No bank</SelectItem>
                                    {banks.map((b) => (
                                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </>
                          )}
                          <div className="flex gap-2">
                            <Button type="button" size="sm" disabled={isPending} onClick={() => submit(r)}>
                              {isPending ? 'Saving…' : 'Confirm'}
                            </Button>
                            <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setOpenId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => open(r)}>Settle</Button>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Clearing posts the amount between Post-Dated Cheques (1112) and the cash account.
        Bouncing reverses the original tender, so the party&rsquo;s balance comes back.
      </p>
    </div>
  )
}
