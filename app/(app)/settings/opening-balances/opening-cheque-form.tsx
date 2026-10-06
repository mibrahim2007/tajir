'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatPKR } from '@/lib/utils/currency'
import { createOpeningPdcAction, editOpeningPdcAction } from '@/app/actions/opening-pdc'
import type { OpeningChequeRow, PartyOption } from './opening-cheques-table'
import { todayPKT } from '@/lib/utils/dates'

const NO_PARTY = 'none'
const RETURN_PATH = '/settings/opening-balances'

/** Encodes the party select value as "<kind>:<id>" so one list can hold both. */
function partyValue(kind: string | null, id: string | null) {
  return kind && id ? `${kind}:${id}` : NO_PARTY
}

type Props = {
  banks: { id: string; name: string }[]
  parties: PartyOption[]
  /** Omitted when adding. */
  cheque?: Pick<OpeningChequeRow,
    'id' | 'direction' | 'chequeNumber' | 'dueDate' | 'asOfDate' | 'amount' | 'partyKind' | 'partyId' | 'partyName' | 'bankId'>
  /** Used as the default "as at" date when adding. */
  today: string
}

// Full-page form at /settings/opening-balances/cheques/new and
// /settings/opening-balances/cheques/[id]/edit (was a drawer on Opening Balances).
export function OpeningChequeForm({ banks, parties, cheque, today }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [direction, setDirection] = useState<'in' | 'out'>(cheque?.direction ?? 'in')
  const [chequeNumber, setChequeNumber] = useState(cheque?.chequeNumber ?? '')
  const [dueDate, setDueDate] = useState(cheque?.dueDate ?? '')
  const [asOfDate, setAsOfDate] = useState(cheque?.asOfDate ?? today)
  const [amount, setAmount] = useState(cheque ? String(cheque.amount) : '')
  const [party, setParty] = useState(partyValue(cheque?.partyKind ?? null, cheque?.partyId ?? null))
  const [partyLabel, setPartyLabel] = useState(cheque?.partyId ? '' : (cheque?.partyName ?? ''))
  const [bankId, setBankId] = useState(cheque?.bankId ?? NO_PARTY)

  // Summary values (display only)
  const partyName = party === NO_PARTY
    ? partyLabel.trim() || null
    : parties.find((p) => `${p.kind}:${p.id}` === party)?.name ?? cheque?.partyName ?? null
  const bankName = banks.find((b) => b.id === bankId)?.name

  const save = () => {
    startTransition(async () => {
      setError(null)
      const [partyKind, partyId] = party === NO_PARTY ? [null, null] : party.split(':')
      const payload = {
        direction,
        chequeNumber,
        chequeDueDate: dueDate,
        asOfDate,
        amount,
        partyKind,
        partyId,
        partyLabel: partyId ? null : partyLabel,
        bankId: bankId === NO_PARTY ? null : bankId,
      }
      const result = cheque
        ? await editOpeningPdcAction({ ...payload, id: cheque.id })
        : await createOpeningPdcAction(payload)
      if (!result.success) { setError(result.error); return }
      // Back to Opening Balances, which re-renders with the cheque. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push(RETURN_PATH)
    })
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

      {/* ── FORM (left on xl) ── */}
      <Card className="min-w-0">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="text-base">Cheque Details</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-6 space-y-1">
            <Label>Side</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as 'in' | 'out')}>
              <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Received — a cheque you hold</SelectItem>
                <SelectItem value="out">Issued — a cheque you have written</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-6 space-y-1">
            <Label>Cheque No. <span className="text-destructive">*</span></Label>
            <Input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="e.g. 0045123" />
          </div>

          <div className="md:col-span-6 space-y-1">
            <Label>Due Date <span className="text-destructive">*</span></Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="md:col-span-6 space-y-1">
            <Label>Amount (PKR) <span className="text-destructive">*</span></Label>
            <Input
              type="number" min="0" step="0.01" inputMode="decimal"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="text-right" placeholder="0.00"
            />
          </div>

          <div className="md:col-span-6 space-y-1">
            <Label>Party</Label>
            <Select value={party} onValueChange={setParty}>
              <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="Not linked" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARTY}>Not linked to a party</SelectItem>
                {parties.map((p) => (
                  <SelectItem key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>
                    {p.kind === 'customer' ? 'Customer' : 'Supplier'} · {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Linking a party means a bounce puts the amount back on their balance.
            </p>
          </div>

          {party === NO_PARTY && (
            <div className="md:col-span-6 space-y-1">
              <Label>Name on the cheque (optional)</Label>
              <Input value={partyLabel} onChange={(e) => setPartyLabel(e.target.value)} placeholder="For your reference only" />
            </div>
          )}

          <div className="md:col-span-6 md:col-start-1 space-y-1">
            <Label>Bank (optional)</Label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARTY}>—</SelectItem>
                {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-6 space-y-1">
            <Label>Opening as at</Label>
            <Input type="date" max={todayPKT()} value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* ── SUMMARY (right on xl, sticky) ── */}
      <div className="xl:sticky xl:top-6">
        <Card>
          <CardContent className="px-5 pt-5 pb-5">
            <p className="font-extrabold text-[15px] tracking-tight mb-4">Cheque Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Side</span>
                <span>{direction === 'in' ? 'Received' : 'Issued'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Cheque No.</span>
                <span className="font-mono text-right truncate">{chequeNumber || '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Due</span>
                <span className="tabular-nums">{dueDate || '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Party</span>
                <span className="font-medium text-right truncate">{partyName ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Bank</span>
                <span className="text-right truncate">{bankName ?? '—'}</span>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex justify-between items-center gap-2 mb-5">
              <span className="font-bold text-sm">Amount</span>
              <span className="text-lg font-extrabold tabular-nums tracking-tight text-right">{formatPKR(parseFloat(amount) || 0)}</span>
            </div>

            <div className="space-y-2">
              <Button className="w-full min-h-[44px]" onClick={save} disabled={isPending}>
                {isPending ? 'Saving…' : cheque ? 'Save Changes' : 'Load Cheque'}
              </Button>
              <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push(RETURN_PATH)}>
                Cancel
              </Button>
            </div>

            {error && <p className="text-sm text-destructive mt-3">{error}</p>}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
