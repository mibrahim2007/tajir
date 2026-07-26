'use client'

import Link from 'next/link'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteButton } from '@/components/delete-button'
import { formatPKR } from '@/lib/utils/currency'
import { deleteOpeningPdcAction } from '@/app/actions/opening-pdc'
import { OpeningChequeForm } from './opening-cheque-form'

export type PartyOption = { kind: 'customer' | 'supplier'; id: string; name: string }

export type OpeningChequeRow = {
  id: string
  serial: string | null
  chequeNumber: string
  /** Raw ISO, for the edit form. */
  dueDate: string
  /** Formatted on the SERVER — formatting dates in this client component
   *  breaks hydration and silently kills the buttons (see the register page). */
  dueLabel: string
  asOfDate: string
  amount: number
  direction: 'in' | 'out'
  partyKind: 'customer' | 'supplier' | 'employee' | 'owner' | null
  partyId: string | null
  partyName: string | null
  bankId: string | null
  bankName: string | null
  status: 'pending' | 'cleared' | 'bounced' | 'endorsed'
  overdue: boolean
}

const STATUS_BADGE: Record<OpeningChequeRow['status'], string> = {
  pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  cleared:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  bounced:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  endorsed: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400',
}

export function OpeningChequesTable({
  cheques,
  banks,
  parties,
  today,
}: {
  cheques: OpeningChequeRow[]
  banks: { id: string; name: string }[]
  parties: PartyOption[]
  today: string
}) {
  const received = cheques.filter((c) => c.direction === 'in' && c.status === 'pending')
  const issued = cheques.filter((c) => c.direction === 'out' && c.status === 'pending')
  const sum = (rs: OpeningChequeRow[]) => rs.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cheques already in hand or already written on the day you started. They post to
          Post-Dated Cheques (1112 received / 2115 issued) against Opening Balance Equity, and
          appear in the{' '}
          <Link href="/reports/pdc-register" className="underline underline-offset-4 hover:text-foreground">
            cheque register
          </Link>{' '}
          where they can be cleared, bounced or handed on like any other cheque.
        </p>
        <OpeningChequeForm
          trigger={<Button className="min-h-[44px] whitespace-nowrap"><Plus className="h-4 w-4 mr-2" />Load Cheque</Button>}
          banks={banks}
          parties={parties}
          today={today}
        />
      </div>

      {cheques.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No opening cheques loaded. Add one for each post-dated cheque that was outstanding at go-live.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Cheque No.</th>
                  <th className="text-left px-4 py-3 font-medium">Party</th>
                  <th className="text-left px-4 py-3 font-medium">Side</th>
                  <th className="text-left px-4 py-3 font-medium">Due</th>
                  <th className="text-left px-4 py-3 font-medium">Bank</th>
                  <th className="text-right px-4 py-3 font-medium">Amount (PKR)</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {cheques.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{c.chequeNumber}</td>
                    <td className="px-4 py-3">{c.partyName ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3">{c.direction === 'in' ? 'Received' : 'Issued'}</td>
                    <td className={`px-4 py-3 ${c.overdue ? 'text-destructive font-medium' : ''}`}>
                      {c.dueLabel}{c.overdue ? ' (overdue)' : ''}
                    </td>
                    <td className="px-4 py-3">{c.bankName ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPKR(c.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {/* Once a cheque has been settled or handed on, other entries
                          sit on top of it — the actions refuse it, so hide them. */}
                      {c.status === 'pending' ? (
                        <div className="flex gap-1 justify-end">
                          <OpeningChequeForm
                            trigger={
                              <Button size="sm" variant="ghost" className="min-h-[44px]">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            }
                            banks={banks}
                            parties={parties}
                            cheque={c}
                            today={today}
                          />
                          <DeleteButton
                            description={`Remove opening cheque ${c.chequeNumber} (${formatPKR(c.amount)})? Its opening ledger entry is removed too.`}
                            onDelete={deleteOpeningPdcAction.bind(null, { id: c.id })}
                          />
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-muted-foreground">settled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/30">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Pending — received {received.length > 0 && `(${received.length})`}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{formatPKR(sum(received))}</td>
                  <td colSpan={2} />
                </tr>
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Pending — issued {issued.length > 0 && `(${issued.length})`}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {formatPKR(sum(issued))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
