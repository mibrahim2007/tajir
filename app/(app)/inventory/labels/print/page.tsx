import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Barcode } from '@/components/barcode'
import { LabelToolbar } from './label-toolbar'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Thermal roll label size, in mm. Tweak here if the stock differs.
const LABEL_W = 50
const LABEL_H = 25

export default async function InventoryLabelsPrintPage({ searchParams }: { searchParams: SearchParams }) {
  const { tenantId } = await requireAuth()
  const params = await searchParams

  const idsRaw = typeof params.ids === 'string' ? params.ids : ''
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean)
  const copies = typeof params.copies === 'string' ? Math.max(1, Math.min(99, parseInt(params.copies, 10) || 1)) : 1

  if (ids.length === 0) notFound()

  const admin = createAdminClient()
  const { data: lots } = await admin
    .from('inventory_lots')
    .select('id, name, sku')
    .eq('tenant_id', tenantId)
    .in('id', ids)

  if (!lots || lots.length === 0) notFound()

  // Preserve the order the ids arrived in, then expand by copy count.
  const byId = new Map(lots.map((l) => [l.id, l]))
  const labels = ids
    .map((id) => byId.get(id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
    .flatMap((l) => Array.from({ length: copies }, () => l))

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      <style>{`
        @media print {
          @page { size: ${LABEL_W}mm ${LABEL_H}mm; margin: 0 }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff }
          .label-sheet { display: block; gap: 0; padding: 0; background: #fff }
          .label { break-after: page; border: none !important; box-shadow: none !important; margin: 0 }
          .label:last-child { break-after: auto }
        }
      `}</style>

      <LabelToolbar copies={copies} />

      <div className="label-sheet flex flex-wrap gap-3 p-6 justify-center">
        {labels.map((lot, i) => (
          <div
            key={`${lot.id}-${i}`}
            className="label bg-white text-black border border-border rounded-sm shadow-sm overflow-hidden flex flex-col items-center justify-center"
            style={{ width: `${LABEL_W}mm`, height: `${LABEL_H}mm`, padding: '2mm' }}
          >
            <div className="w-full text-center text-[10px] font-semibold leading-tight truncate" title={lot.name}>
              {lot.name}
            </div>
            <div className="flex-1 w-full flex items-center justify-center min-h-0">
              <Barcode value={lot.sku} height={34} width={1.4} fontSize={11} />
            </div>
          </div>
        ))}
      </div>

      <p className="print:hidden text-center text-xs text-muted-foreground pb-8">
        {labels.length} label{labels.length !== 1 ? 's' : ''} · {LABEL_W}×{LABEL_H} mm · Code 128
      </p>
    </div>
  )
}
