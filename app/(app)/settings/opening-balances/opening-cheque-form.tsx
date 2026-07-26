'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createOpeningPdcAction, editOpeningPdcAction } from '@/app/actions/opening-pdc'
import type { OpeningChequeRow, PartyOption } from './opening-cheques-table'

const NO_PARTY = 'none'

/** Encodes the party select value as "<kind>:<id>" so one list can hold both. */
function partyValue(kind: string | null, id: string | null) {
  return kind && id ? `${kind}:${id}` : NO_PARTY
}

type Props = {
  trigger: ReactNode
  banks: { id: string; name: string }[]
  parties: PartyOption[]
  /** Omitted when adding. */
  cheque?: OpeningChequeRow
  /** Used as the default "as at" date when adding. */
  today: string
}

export function OpeningChequeForm({ trigger, banks, parties, cheque, today }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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

  const reset = () => {
    setError(null)
    setDirection(cheque?.direction ?? 'in')
    setChequeNumber(cheque?.chequeNumber ?? '')
    setDueDate(cheque?.dueDate ?? '')
    setAsOfDate(cheque?.asOfDate ?? today)
    setAmount(cheque ? String(cheque.amount) : '')
    setParty(partyValue(cheque?.partyKind ?? null, cheque?.partyId ?? null))
    setPartyLabel(cheque?.partyId ? '' : (cheque?.partyName ?? ''))
    setBankId(cheque?.bankId ?? NO_PARTY)
  }

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
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) reset() }}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{cheque ? 'Edit Opening Cheque' : 'Load Opening Cheque'}</SheetTitle>
          <SheetDescription>
            A post-dated cheque that already existed before you started using Tajir.
            It is posted against Opening Balance Equity, so enter the party&rsquo;s own
            opening balance <strong>net of</strong> this cheque.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 mt-6">
          <div className="space-y-1">
            <Label>Side</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as 'in' | 'out')}>
              <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Received — a cheque you hold</SelectItem>
                <SelectItem value="out">Issued — a cheque you have written</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Cheque No. <span className="text-destructive">*</span></Label>
            <Input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="e.g. 0045123" />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label>Due Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <Label>Amount (PKR) <span className="text-destructive">*</span></Label>
              <Input
                type="number" min="0" step="0.01" inputMode="decimal"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="text-right" placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Party</Label>
            <Select value={party} onValueChange={setParty}>
              <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Not linked" /></SelectTrigger>
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
            <div className="space-y-1">
              <Label>Name on the cheque (optional)</Label>
              <Input value={partyLabel} onChange={(e) => setPartyLabel(e.target.value)} placeholder="For your reference only" />
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label>Bank (optional)</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARTY}>—</SelectItem>
                  {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label>Opening as at</Label>
              <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full min-h-[44px]" onClick={save} disabled={isPending}>
            {isPending ? 'Saving…' : cheque ? 'Save Changes' : 'Load Cheque'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
