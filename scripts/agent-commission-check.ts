/**
 * Commission arithmetic check — `npm run check:agent-commission`.
 *
 * The rate a broker is paid on is the one number in this feature nobody can
 * eyeball from the ledger, so the pure function behind it is pinned here.
 * No database or network: `computeCommission` is deliberately I/O-free so the
 * server actions and the live preview on the invoice forms share it exactly.
 */
import { computeCommission, formatCommissionRate, roundMoney } from '../lib/agents/commission'

type Case = {
  name: string
  basis: Parameters<typeof computeCommission>[0]
  expected: number
}

const cases: Case[] = [
  // ── percentage ───────────────────────────────────────────────
  {
    name: '1.5% of a 1,000,000 sale',
    basis: { type: 'percentage', rate: 1.5, baseAmount: 1_000_000, baseQuantity: 200 },
    expected: 15_000,
  },
  {
    name: 'percentage rounds to paisa, never a long tail',
    basis: { type: 'percentage', rate: 1.75, baseAmount: 33_333.33, baseQuantity: 7 },
    expected: 583.33,
  },
  {
    name: 'percentage ignores quantity entirely',
    basis: { type: 'percentage', rate: 2, baseAmount: 500_000, baseQuantity: 0 },
    expected: 10_000,
  },

  // ── per unit ─────────────────────────────────────────────────
  {
    name: 'Rs 12 per unit on 250 units',
    basis: { type: 'per_unit', rate: 12, baseAmount: 900_000, baseQuantity: 250 },
    expected: 3_000,
  },
  {
    name: 'per-unit ignores invoice value entirely',
    basis: { type: 'per_unit', rate: 5, baseAmount: 0, baseQuantity: 100 },
    expected: 500,
  },
  {
    name: 'fractional quantity still pays',
    basis: { type: 'per_unit', rate: 10, baseAmount: 50_000, baseQuantity: 12.5 },
    expected: 125,
  },

  // ── flat ─────────────────────────────────────────────────────
  {
    name: 'flat fee does not scale with the invoice',
    basis: { type: 'flat', rate: 2_500, baseAmount: 4_000_000, baseQuantity: 900 },
    expected: 2_500,
  },
  {
    name: 'flat fee on a zero-value invoice accrues nothing',
    basis: { type: 'flat', rate: 2_500, baseAmount: 0, baseQuantity: 0 },
    expected: 0,
  },

  // ── nothing accrues ──────────────────────────────────────────
  {
    name: "type 'none' never accrues",
    basis: { type: 'none', rate: 5, baseAmount: 1_000_000, baseQuantity: 100 },
    expected: 0,
  },
  {
    name: 'a zero rate never accrues',
    basis: { type: 'percentage', rate: 0, baseAmount: 1_000_000, baseQuantity: 100 },
    expected: 0,
  },
  {
    name: 'a negative rate never accrues (it would DEBIT the agent)',
    basis: { type: 'percentage', rate: -1, baseAmount: 1_000_000, baseQuantity: 100 },
    expected: 0,
  },
  {
    name: 'a NaN rate never accrues',
    basis: { type: 'per_unit', rate: NaN, baseAmount: 1_000_000, baseQuantity: 100 },
    expected: 0,
  },
]

let failed = 0

for (const c of cases) {
  const actual = computeCommission(c.basis)
  const ok = Object.is(actual, c.expected)
  if (!ok) failed++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${c.name}\n` +
      `      ${formatCommissionRate(c.basis.type, c.basis.rate)}` +
      ` → expected ${c.expected}, got ${actual}`,
  )
}

// The GL legs are built from ONE rounded figure, so debit and credit tie by
// construction. Pin that the rounding itself is half-up at two decimals.
const roundingCases: [number, number][] = [
  [0.005, 0.01],
  [1.005, 1.01],
  [2.675, 2.68],
  [-1.005, -1],
]
for (const [input, expected] of roundingCases) {
  const actual = roundMoney(input)
  const ok = Object.is(actual, expected)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  roundMoney(${input}) → expected ${expected}, got ${actual}`)
}

console.log(
  failed === 0
    ? `\nAll ${cases.length + roundingCases.length} checks passed.`
    : `\n${failed} check(s) FAILED.`,
)
process.exit(failed === 0 ? 0 : 1)
