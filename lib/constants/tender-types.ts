import { z } from 'zod'

// Tender types for a receipt/payment detail line. Each maps to the chart-of-
// accounts system_key its money leg posts to in the GL.
//   Cash   → Cash in Hand (1110)
//   Online → Cash at Bank (1120)
//   PDC    → Post-Dated Cheques (1112)
export const TENDER_TYPES = [
  { value: 'cash',   label: 'Cash',   account: 'cash_in_hand' },
  { value: 'online', label: 'Online', account: 'cash_at_bank' },
  { value: 'pdc',    label: 'PDC',    account: 'post_dated_cheques' },
] as const

export type TenderType = (typeof TENDER_TYPES)[number]['value']

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
export function aggregateMoneyLegs(
  lines: { transactionType: TenderType; amount: number }[],
  rate: number,
): { accountSystemKey: string; pkr: number }[] {
  const byAccount = new Map<string, number>()
  for (const l of lines) {
    const key = TENDER_ACCOUNT[l.transactionType]
    byAccount.set(key, (byAccount.get(key) ?? 0) + l.amount * rate)
  }
  return [...byAccount.entries()].map(([accountSystemKey, pkr]) => ({ accountSystemKey, pkr }))
}
