import { z } from 'zod'

// Tender types for a receipt/payment detail line. Each maps to the chart-of-
// accounts system_key its money leg posts to in the GL.
//   Cash   → Cash in Hand (1110)
//   Online → Cash at Bank (1120)
//   PDC    → Post-Dated Cheques Received (1112, asset) when the cheque comes
//            IN, or Post-Dated Cheques Issued (2115, liability) when it goes
//            OUT — resolved by document direction, see pdcAccount().
export const TENDER_TYPES = [
  { value: 'cash',   label: 'Cash',   account: 'cash_in_hand' },
  { value: 'online', label: 'Online', account: 'cash_at_bank' },
  { value: 'pdc',    label: 'PDC',    account: 'post_dated_cheques' },
] as const

export type TenderType = (typeof TENDER_TYPES)[number]['value']

/** Money flow of a document: 'in' = we receive, 'out' = we pay. */
export type MoneyDirection = 'in' | 'out'

export const PDC_ASSET_KEY = 'post_dated_cheques'
export const PDC_LIABILITY_KEY = 'post_dated_cheques_payable'

// A post-dated cheque is an asset while it is one we hold (money coming in) and
// a liability while it is one we have written (money going out). Splitting them
// keeps the Balance Sheet honest — a single account nets the two and can show a
// liability as a negative asset.
export function pdcAccount(direction: MoneyDirection): string {
  return direction === 'in' ? PDC_ASSET_KEY : PDC_LIABILITY_KEY
}

/** The money-leg account for a tender line, given the document's direction. */
export function tenderAccount(type: TenderType, direction: MoneyDirection): string {
  return type === 'pdc' ? pdcAccount(direction) : TENDER_ACCOUNT[type]
}

export const TENDER_ACCOUNT: Record<TenderType, string> = {
  cash:   'cash_in_hand',
  online: 'cash_at_bank',
  pdc:    'post_dated_cheques',
}

export const TENDER_LABEL: Record<TenderType, string> = {
  cash:   'Cash',
  online: 'Online',
  pdc:    'PDC',
}

// ── Shared tender-line validation ───────────────────────────────────
// A PDC is a specific physical cheque; without its number the row is unusable
// for reconciling against the bank later. The rule lives here because the same
// line shape is validated in ten forms AND the ten server actions behind them —
// twenty copies previously, which is twenty chances to forget it.

export const PDC_CHEQUE_REQUIRED = 'Cheque no. is required for a PDC'
export const PDC_DUE_DATE_REQUIRED = 'Due date is required for a PDC'

function requireChequeForPdc(
  line: { transactionType: string; chequeNumber?: string | null; chequeDueDate?: string | null },
  ctx: z.RefinementCtx,
) {
  if (line.transactionType !== 'pdc') return

  if (!line.chequeNumber?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['chequeNumber'],
      message: PDC_CHEQUE_REQUIRED,
    })
  }

  // Without a due date the cheque never becomes overdue and sorts last forever,
  // so it silently drops out of the pending list it exists to appear on.
  if (!line.chequeDueDate?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['chequeDueDate'],
      message: PDC_DUE_DATE_REQUIRED,
    })
  }
}

// A line that hands on a received cheque only makes sense as a PDC: the money
// leaves through 1112, which is what the 'pdc' tender type posts. Cash or
// online with an endorsement link would credit the wrong account entirely.
function requirePdcForEndorsement(
  line: { transactionType: string; endorsedFromLineId?: string | null },
  ctx: z.RefinementCtx,
) {
  if (line.endorsedFromLineId?.trim() && line.transactionType !== 'pdc') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['transactionType'],
      message: 'A handed-on cheque must use the PDC tender type',
    })
  }
}

/** Server-side shape: amounts must already be positive. */
export const tenderLineSchema = z
  .object({
    transactionType: z.enum(['cash', 'pdc', 'online']),
    chequeNumber:    z.string().trim().optional().nullable(),
    chequeDueDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
    bankId:          z.string().uuid().optional().nullable(),
    amount:          z.coerce.number().positive('Line amount must be positive'),
    // Set when this line hands on a cheque received from a party rather than
    // writing a new one. The server re-reads the cheque and copies its amount,
    // so these are a reference, not trusted data.
    endorsedFromSource: z.string().optional().nullable(),
    endorsedFromLineId: z.string().uuid().optional().nullable(),
  })
  .superRefine(requireChequeForPdc)
  .superRefine(requirePdcForEndorsement)

/**
 * Client-side shape: blank/NaN amounts collapse to 0 so an untouched spare row
 * doesn't block submit — those rows are dropped before the action is called.
 * The cheque rule still applies to any row the user actually set to PDC.
 */
export const tenderLineFormSchema = z
  .object({
    transactionType: z.enum(['cash', 'pdc', 'online']),
    chequeNumber:    z.string().optional().default(''),
    chequeDueDate:   z.string().optional().default(''),
    bankId:          z.string().optional().default(''),
    amount:          z.preprocess(
      (v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? 0 : v),
      z.coerce.number().min(0),
    ),
    // Optional rather than defaulted: a defaulted field infers as a required
    // string, which every existing `emptyLine` in the ten forms would fail.
    endorsedFromSource: z.string().optional(),
    endorsedFromLineId: z.string().optional(),
  })
  .superRefine(requireChequeForPdc)
  .superRefine(requirePdcForEndorsement)

// Aggregate tender lines into GL money legs, summing PKR by target account so a
// receipt/payment with several lines of the same type posts one clean GL line.
// `direction` decides which PDC account a cheque leg lands in (asset vs
// liability); it does not affect cash or online.
//
// An ENDORSED pdc line is the exception: it hands on a cheque RECEIVED from a
// party, so its money leg disposes the received-cheque ASSET (1112) — it must
// never touch the issued-cheque liability (2115), even though the document
// itself pays money out. Getting this wrong leaves the received cheque sitting
// in 1112 and conjures a phantom liability in 2115.
export function aggregateMoneyLegs(
  lines: { transactionType: TenderType; amount: number; endorsed?: boolean }[],
  rate: number,
  direction: MoneyDirection,
): { accountSystemKey: string; pkr: number }[] {
  const byAccount = new Map<string, number>()
  for (const l of lines) {
    const key = l.transactionType === 'pdc' && l.endorsed
      ? PDC_ASSET_KEY
      : tenderAccount(l.transactionType, direction)
    byAccount.set(key, (byAccount.get(key) ?? 0) + l.amount * rate)
  }
  return [...byAccount.entries()].map(([accountSystemKey, pkr]) => ({ accountSystemKey, pkr }))
}
