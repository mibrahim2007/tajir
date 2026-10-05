'use client'

import { useFieldArray, useFormContext, Controller } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChequePicker, NEW_CHEQUE, chequeKey } from '@/components/cheque-picker'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { TENDER_TYPES, DIRECT_TENDER } from '@/lib/constants/tender-types'
import { formatPKR } from '@/lib/utils/currency'

export type TenderLine = {
  transactionType: 'cash' | 'pdc' | 'online'
  chequeNumber:    string
  chequeDueDate:   string
  bankId:          string
  amount:          number
  /** Set when this line hands on a cheque received from a party. */
  endorsedFromSource?: string
  endorsedFromLineId?: string
}

/**
 * A customer-receipt line: a TenderLine that may also be a Direct Payment.
 * Kept separate so the other money forms never see the 'direct' type.
 */
export type ReceiptTenderLine = Omit<TenderLine, 'transactionType'> & {
  transactionType: TenderLine['transactionType'] | 'direct'
  /** The supplier the customer paid on our behalf. */
  supplierId?: string
  /** Free-text hawala / slip reference. */
  hawalaRemarks?: string
}

type Bank = { id: string; name: string; account_number: string | null }
type Supplier = { id: string; name: string }

/** A received cheque that can be handed on instead of writing a new one. */
export type EndorsableCheque = {
  source: string
  lineId: string
  chequeNumber: string | null
  dueDate: string | null
  amount: number
  partyName: string | null
  docSerial: string | null
}

// Breakpoint-specific classes, written out in full so Tailwind can see them.
// 'compact' becomes a table row at sm (narrow dialogs); 'wide' waits until lg
// because its seven columns need the room, and stacks below that.
const LAYOUT = {
  compact: {
    header: 'hidden sm:grid',
    list:   'space-y-3 sm:space-y-2',
    row:    'rounded-lg border p-3 sm:border-0 sm:p-0 sm:rounded-none grid grid-cols-1 gap-2 sm:items-start',
    label:  'sm:hidden',
    h:      'min-h-[44px] sm:min-h-[40px]',
    del:    'flex justify-end sm:block',
    delBtn: 'min-h-[40px] sm:h-10 sm:w-9 sm:p-0 text-muted-foreground hover:text-destructive',
    delTxt: 'sm:hidden ml-1.5',
  },
  wide: {
    header: 'hidden lg:grid',
    list:   'space-y-3 lg:space-y-2',
    row:    'rounded-lg border p-3 lg:border-0 lg:p-0 lg:rounded-none grid grid-cols-1 gap-2 lg:items-start',
    label:  'lg:hidden',
    h:      'min-h-[44px] lg:min-h-[40px]',
    del:    'flex justify-end lg:block',
    delBtn: 'min-h-[40px] lg:h-10 lg:w-9 lg:p-0 text-muted-foreground hover:text-destructive',
    delTxt: 'lg:hidden ml-1.5',
  },
} as const

// minmax(0,…) lets columns shrink so long bank or supplier names never push the
// grid past the container.
const COLUMNS = {
  compact:        'sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1.6fr)_110px_36px]',
  wide:           'lg:grid-cols-[140px_minmax(0,1fr)_minmax(0,1.6fr)_150px_36px]',
  wideWithDirect: 'lg:grid-cols-[150px_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_150px_36px]',
} as const

// Small per-field label shown only while fields stack (where the column header
// row is hidden), so Bank/Amount can't be confused. `hide` is the breakpoint
// class at which the header row takes over.
function FieldLabel({ hide, children }: { hide: string; children: React.ReactNode }) {
  return <span className={`${hide} text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>{children}</span>
}

// Editable split-tender table: one row per tender (Cash / PDC / Online, plus
// Direct Payment on receipts), each with an optional cheque number and bank
// plus an amount. Reads/writes the `lines` field array on the surrounding
// react-hook-form.
export function TenderLinesField({
  banks,
  currency = 'PKR',
  endorsableCheques = [],
  suppliers,
  layout = 'compact',
}: {
  banks: Bank[]
  currency?: string
  /**
   * Customer receipts only. Passing this offers a "Direct Payment" type: the
   * customer paid one of these suppliers on our behalf, recorded with the
   * supplier and free-text Hawala remarks.
   */
  suppliers?: Supplier[]
  /** Received cheques in hand. Passing any turns PDC's Cheque No. into a picker. */
  endorsableCheques?: EndorsableCheque[]
  /**
   * 'compact' (default) fits narrow containers: on a Direct Payment row the
   * cheque cell becomes the supplier and the bank cell the Hawala remarks.
   * 'wide' is for full-page forms: every column gets its own cell, and the
   * ones that don't apply to a row's type are greyed out.
   */
  layout?: 'compact' | 'wide'
}) {
  const { control, register, watch, setValue, formState } = useFormContext<{ lines: ReceiptTenderLine[] }>()
  const allowDirect = !!suppliers
  const wide = layout === 'wide'
  const L = LAYOUT[layout]
  const cols = wide ? (allowDirect ? COLUMNS.wideWithDirect : COLUMNS.wide) : COLUMNS.compact
  const supplierItems = (suppliers ?? []).map((sp) => ({ id: sp.id, name: sp.name }))
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  const lines = watch('lines') ?? []
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const linesError = formState.errors.lines as
    | ({ message?: string; root?: { message?: string } } & Array<
        { chequeNumber?: { message?: string }; chequeDueDate?: { message?: string }; supplierId?: { message?: string } } | undefined
      >)
    | undefined
  const rootError = linesError?.message ?? linesError?.root?.message
  // Per-line errors were previously not rendered at all, so a per-field rule
  // (e.g. cheque required for a PDC) would have blocked submit invisibly.
  const chequeError = (i: number) => linesError?.[i]?.chequeNumber?.message
  const dueDateError = (i: number) => linesError?.[i]?.chequeDueDate?.message
  const supplierError = (i: number) => linesError?.[i]?.supplierId?.message

  // Handing on a received cheque only makes sense in the base currency: the
  // cheque is written for a fixed number of rupees, so it can't settle a line
  // denominated in something else.
  const canEndorse = endorsableCheques.length > 0 && currency === 'PKR'

  /**
   * Copies the chosen cheque onto the line. The amount comes from the cheque
   * and is locked afterwards — a physical cheque is for what it is for, and a
   * mismatch would leave 1112 holding a balance for a cheque that is gone.
   */
  const pickCheque = (i: number, key: string) => {
    if (key === NEW_CHEQUE) {
      setValue(`lines.${i}.endorsedFromSource`, '')
      setValue(`lines.${i}.endorsedFromLineId`, '')
      setValue(`lines.${i}.chequeNumber`, '')
      setValue(`lines.${i}.chequeDueDate`, '')
      setValue(`lines.${i}.amount`, 0, { shouldValidate: true })
      return
    }
    const cheque = endorsableCheques.find((c) => chequeKey(c) === key)
    if (!cheque) return
    setValue(`lines.${i}.endorsedFromSource`, cheque.source)
    setValue(`lines.${i}.endorsedFromLineId`, cheque.lineId)
    setValue(`lines.${i}.chequeNumber`, cheque.chequeNumber ?? '')
    setValue(`lines.${i}.chequeDueDate`, cheque.dueDate ?? '')
    setValue(`lines.${i}.amount`, cheque.amount, { shouldValidate: true })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Tender Breakdown <span className="text-destructive">*</span></Label>
        <span className="text-xs text-muted-foreground">{currency !== 'PKR' ? `Amounts in ${currency}` : allowDirect ? 'Cash · PDC · Online · Direct' : 'Cash · PDC · Online'}</span>
      </div>

      <div className={`${L.header} ${cols} gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
        <span>Type</span>
        {wide ? (
          <>
            <span>Cheque No.</span>
            <span>Bank</span>
            {allowDirect && <span>Supplier</span>}
            {allowDirect && <span>Hawala Remarks</span>}
          </>
        ) : (
          <>
            <span>{allowDirect ? 'Cheque No. / Supplier' : 'Cheque No.'}</span>
            <span>{allowDirect ? 'Bank / Hawala Remarks' : 'Bank'}</span>
          </>
        )}
        <span className="text-right">Amount</span>
        <span />
      </div>

      <div className={L.list}>
        {fields.map((field, i) => {
          const type = lines[i]?.transactionType ?? 'cash'
          const isDirect = type === 'direct'
          const supplierErr = supplierError(i)
          // A direct line never touched a cheque or a bank account.
          const chequeDisabled = type === 'cash' || isDirect
          const bankDisabled   = type === 'cash' || isDirect
          // A PDC is a specific physical cheque — without its number the row
          // can't be reconciled against the bank later.
          const chequeRequired = type === 'pdc'
          const chequeErr = chequeError(i)
          const dueErr = dueDateError(i)
          const endorsedKey = lines[i]?.endorsedFromLineId
            ? `${lines[i]?.endorsedFromSource}:${lines[i]?.endorsedFromLineId}`
            : NEW_CHEQUE
          const isEndorsed = endorsedKey !== NEW_CHEQUE
          // A cheque already spent on another line of this same document must
          // not be offered again — it is one piece of paper.
          const takenElsewhere = new Set(
            lines
              .filter((l, j) => j !== i && l.endorsedFromLineId)
              .map((l) => `${l.endorsedFromSource}:${l.endorsedFromLineId}`),
          )
          const options = endorsableCheques.filter((c) => !takenElsewhere.has(chequeKey(c)))

          const chequeCell = (
            <div className="min-w-0 space-y-1">
              <FieldLabel hide={L.label}>Cheque No.{chequeRequired && <span className="text-destructive"> *</span>}</FieldLabel>

              {/* With cheques in hand, a PDC can either hand one of them on or
                  write a new one — so the number becomes a picker with an
                  explicit "write a new cheque" escape. */}
              {chequeRequired && canEndorse && (
                <ChequePicker
                  value={endorsedKey}
                  onValueChange={(v) => pickCheque(i, v)}
                  cheques={options}
                />
              )}

              {/* An endorsed line's number and date belong to the cheque, so
                  they are shown read-only rather than edited here. */}
              <Input
                placeholder={chequeDisabled ? '—' : chequeRequired ? 'Cheque No. (required)' : 'Cheque No.'}
                disabled={chequeDisabled}
                readOnly={isEndorsed}
                aria-invalid={!!chequeErr}
                className={`${L.h} min-w-0 ${isEndorsed ? 'bg-muted text-muted-foreground' : ''} ${chequeErr ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                {...register(`lines.${i}.chequeNumber`)}
              />
              {chequeErr && <p className="text-xs text-destructive">{chequeErr}</p>}
              {/* Only a PDC has a maturity date — it drives the pending-cheque
                  list and the overdue flag on the register. */}
              {chequeRequired && (
                <>
                  <Input
                    type="date"
                    title={isEndorsed ? "The cheque's own due date" : 'Cheque due date (required)'}
                    aria-label="Cheque due date"
                    aria-invalid={!!dueErr}
                    readOnly={isEndorsed}
                    className={`min-h-[36px] text-xs min-w-0 ${isEndorsed ? 'bg-muted text-muted-foreground' : ''} ${dueErr ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    {...register(`lines.${i}.chequeDueDate`)}
                  />
                  {dueErr && <p className="text-xs text-destructive">{dueErr}</p>}
                  {isEndorsed && (
                    <p className="text-[11px] text-muted-foreground">Handed on — amount fixed by the cheque</p>
                  )}
                </>
              )}
            </div>
          )

          const bankCell = (
            <div className="min-w-0 space-y-1">
              <FieldLabel hide={L.label}>Bank</FieldLabel>
              <Controller
                control={control}
                name={`lines.${i}.bankId`}
                render={({ field: f }) => (
                  <Select value={f.value || '__none__'} onValueChange={(v) => f.onChange(v === '__none__' ? '' : v)} disabled={bankDisabled}>
                    {/* w-full overrides the trigger's default w-fit so a long bank
                        name can't grow the trigger past its column; the value span
                        is forced to a truncating block. */}
                    <SelectTrigger className={`${L.h} w-full min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:!block [&>span]:truncate`}><SelectValue placeholder="Bank" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No bank</SelectItem>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}{b.account_number ? ` — ${b.account_number}` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )

          // Direct Payment: who the customer paid on our behalf. That
          // supplier's payable drops by the line amount.
          const supplierCell = (
            <div className="min-w-0 space-y-1">
              <FieldLabel hide={L.label}>Supplier{isDirect && <span className="text-destructive"> *</span>}</FieldLabel>
              <Controller
                control={control}
                name={`lines.${i}.supplierId`}
                render={({ field: f }) => (
                  <ItemPickerDialog
                    items={supplierItems}
                    value={isDirect ? (f.value ?? '') : ''}
                    onSelect={(v) => f.onChange(v)}
                    placeholder={isDirect ? 'Select supplier…' : '—'}
                    title="Supplier paid by the customer"
                    disabled={!isDirect}
                  />
                )}
              />
              {supplierErr && <p className="text-xs text-destructive">{supplierErr}</p>}
            </div>
          )

          const hawalaCell = (
            <div className="min-w-0 space-y-1">
              <FieldLabel hide={L.label}>Hawala Remarks</FieldLabel>
              <Input
                placeholder={isDirect ? 'Hawala / slip reference' : '—'}
                maxLength={500}
                disabled={!isDirect}
                className={`${L.h} min-w-0`}
                {...register(`lines.${i}.hawalaRemarks`)}
              />
            </div>
          )

          return (
            // Stacked: each field full-width with its own label inside a
            // bordered card. Table: aligns to the header grid above.
            <div key={field.id} className={`${L.row} ${cols}`}>
              <div className="min-w-0 space-y-1">
                <FieldLabel hide={L.label}>Type</FieldLabel>
                <Controller
                  control={control}
                  name={`lines.${i}.transactionType`}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger className={`${L.h} w-full min-w-0`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TENDER_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                        {allowDirect && (
                          <SelectItem value={DIRECT_TENDER.value}>{DIRECT_TENDER.label}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {wide ? (
                <>
                  {chequeCell}
                  {bankCell}
                  {allowDirect && supplierCell}
                  {allowDirect && hawalaCell}
                </>
              ) : isDirect ? (
                <>
                  {supplierCell}
                  {hawalaCell}
                </>
              ) : (
                <>
                  {chequeCell}
                  {bankCell}
                </>
              )}

              <div className="min-w-0 space-y-1">
                <FieldLabel hide={L.label}>Amount</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  readOnly={isEndorsed}
                  title={isEndorsed ? 'Set by the cheque being handed on' : undefined}
                  className={`${L.h} text-right min-w-0 ${isEndorsed ? 'bg-muted text-muted-foreground' : ''}`}
                  {...register(`lines.${i}.amount`, { valueAsNumber: true })}
                />
              </div>

              <div className={L.del}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={L.delBtn}
                  onClick={() => (fields.length > 1 ? remove(i) : null)}
                  disabled={fields.length <= 1}
                  title="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className={L.delTxt}>Remove</span>
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[40px]"
          onClick={() => append({ transactionType: 'cash', chequeNumber: '', chequeDueDate: '', bankId: '', amount: 0, endorsedFromSource: '', endorsedFromLineId: '', supplierId: '', hawalaRemarks: '' })}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Line
        </Button>
        <div className="text-sm">
          <span className="text-muted-foreground mr-2">Total</span>
          <span className="font-semibold tabular-nums">{currency !== 'PKR' ? `${currency} ${total.toLocaleString()}` : formatPKR(total)}</span>
        </div>
      </div>

      {rootError && <p className="text-xs text-destructive">{rootError}</p>}
    </div>
  )
}
