// The small grey line under an item on invoice prints and reports: yarn
// attributes, grade, lot and cartons, whichever the line carries.

const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 3 })

export type PrintLine = {
  yarn_type?: string | null
  yarn_weight?: number | null
  multiply_by?: number | null
  grade_id?: string | null
  lot_no?: string | null
  nos_carton?: number | null
  weight_per_carton?: number | null
}

export function lineDetails(line: PrintLine, gradeNames: Map<string, string>): string {
  return [
    line.yarn_type,
    line.yarn_weight != null ? `Wt ${fmt(Number(line.yarn_weight))}` : null,
    line.multiply_by != null && Number(line.multiply_by) !== 1 ? `× ${fmt(Number(line.multiply_by))}` : null,
    line.grade_id ? (gradeNames.get(line.grade_id) ?? null) : null,
    line.lot_no ? `Lot ${line.lot_no}` : null,
    line.nos_carton != null
      ? `${fmt(Number(line.nos_carton))} ctn${line.weight_per_carton != null ? ` × ${fmt(Number(line.weight_per_carton))} kg` : ''}`
      : null,
  ].filter(Boolean).join(' · ')
}
