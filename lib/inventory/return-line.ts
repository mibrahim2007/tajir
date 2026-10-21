import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { normalizeMultiplyBy } from '@/lib/yarn'
import { usesCartons, usesYarnFields, cartonStockQty, lineQtyLbs, lineGrossAmount, needsWeight } from '@/lib/item-formula'
import { loadProfilesFor, profileOf, type ItemProfile } from './item-profiles'
import { resolveLineTracking, findPositionShortfalls, type OutgoingLine } from './line-tracking'
import { loadStockPositions } from './stock-position'

// Shared by the four sale / purchase return actions: measures a return line by
// its item type's formula (cartons, weight, QTY LBS, yarn multiplier), settles
// its grade / lot, and checks grade / lot stock when goods go OUT.

const blankToNull = (v: unknown) =>
  v === '' || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? null : v

// Extra fields every return action accepts on top of its own schema.
export const returnLineFields = {
  nosCarton:       z.preprocess(blankToNull, z.coerce.number().min(0).nullable()).optional(),
  weightPerCarton: z.preprocess(blankToNull, z.coerce.number().min(0).nullable()).optional(),
  gradeId:         z.preprocess(blankToNull, z.string().uuid().nullable()).optional(),
  lotNo:           z.preprocess(blankToNull, z.string().trim().max(60).nullable()).optional(),
}

// The original invoice line a return is booked against. Its grade and lot are
// the ones the goods carried, so they win over whatever the form sent.
export type OriginalLine = {
  grade_id: string | null
  lot_no: string | null
  weight_per_carton: number | null
}

export type MeasuredReturnLine = {
  profile:         ItemProfile
  isYarn:          boolean
  multiplyBy:      number
  quantity:        number
  nosCarton:       number | null
  weightPerCarton: number | null
  qtyLbs:          number | null
  pkrEquivalent:   number
  gradeId:         string | null
  lotNo:           string | null
}

export async function measureReturnLine(
  admin: SupabaseClient,
  tenantId: string,
  input: {
    stockItemId: string
    quantity?: number | null
    rate: number
    fx: number
    multiplyBy?: number | null
    nosCarton?: number | null
    weightPerCarton?: number | null
    gradeId?: string | null
    lotNo?: string | null
    original?: OriginalLine | null
  },
): Promise<{ ok: true; line: MeasuredReturnLine } | { ok: false; error: string }> {
  const profile = profileOf(await loadProfilesFor(admin, tenantId, [input.stockItemId]), input.stockItemId)
  const formula = profile.formula
  const isYarn = usesYarnFields(formula)
  const isCarton = usesCartons(formula)
  const multiplyBy = isYarn ? normalizeMultiplyBy(input.multiplyBy) : 1

  const nosCarton = isCarton ? (input.nosCarton ?? null) : null
  // A linked return defaults its weight per carton to the original line's.
  const weightPerCarton = isCarton
    ? (input.weightPerCarton ?? input.original?.weight_per_carton ?? profile.stdPackWeight ?? null)
    : null
  const measure = { quantity: input.quantity ?? 0, nosCarton, weightPerCarton, multiplyBy }

  // Never trust a client-derived quantity for carton lines.
  const quantity = cartonStockQty(formula, measure) ?? (input.quantity ?? 0)
  if (!(quantity > 0)) {
    return {
      ok: false,
      error: isCarton ? `Enter Nos Carton${needsWeight(formula) ? ' and Weight' : ''}` : 'Quantity must be positive',
    }
  }

  const tracking = input.original
    ? {
        ok: true as const,
        gradeId: profile.trackGrade ? input.original.grade_id : null,
        lotNo: profile.trackLot ? input.original.lot_no : null,
      }
    : resolveLineTracking(profile, { gradeId: input.gradeId, lotNo: input.lotNo }, { lineLabel: 'Return line' })
  if (!tracking.ok) return { ok: false, error: tracking.error }

  return {
    ok: true,
    line: {
      profile,
      isYarn,
      multiplyBy,
      quantity,
      nosCarton,
      weightPerCarton,
      qtyLbs: lineQtyLbs(formula, measure),
      pkrEquivalent: lineGrossAmount(formula, { ...measure, quantity }, input.rate, input.fx),
      gradeId: tracking.gradeId,
      lotNo: tracking.lotNo,
    },
  }
}

// Refuses when lines taking stock OUT of a tracked grade / lot exceed what that
// position holds. `credit` is stock the same document already took (an edit).
export async function checkPositionStock(
  admin: SupabaseClient,
  tenantId: string,
  outgoing: OutgoingLine[],
  credit: OutgoingLine[] = [],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tracked = outgoing.filter((l) => l.locationId && (l.trackGrade || l.trackLot))
  if (tracked.length === 0) return { ok: true }
  const positions = await loadStockPositions(admin, tenantId, { stockItemIds: tracked.map((l) => l.stockItemId) })
  const short = findPositionShortfalls(positions, tracked, credit)
  if (short.length === 0) return { ok: true }

  const s = short[0]
  const [{ data: item }, { data: grade }, { data: loc }] = await Promise.all([
    admin.from('inventory_lots').select('name').eq('id', s.stockItemId).eq('tenant_id', tenantId).maybeSingle(),
    s.gradeId
      ? admin.from('grades').select('name').eq('id', s.gradeId).eq('tenant_id', tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('locations').select('name').eq('id', s.locationId).eq('tenant_id', tenantId).maybeSingle(),
  ])
  const what = [
    item?.name ?? 'This item',
    grade?.name ? `grade ${grade.name}` : null,
    s.lotNo ? `lot ${s.lotNo}` : null,
  ].filter(Boolean).join(', ')
  const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 3 })
  return {
    ok: false,
    error: `Not enough stock: ${what} has ${fmt(Math.max(0, s.available))} at ${loc?.name ?? 'this location'}, but ${fmt(s.requested)} is being returned.`,
  }
}
