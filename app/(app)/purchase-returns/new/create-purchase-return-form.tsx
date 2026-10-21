'use client'

import React, { useRef, useState, useTransition, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ExitButton } from '@/components/exit-button'
import { useForm, useFieldArray, type Resolver, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { NumericInput } from '@/components/numeric-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ItemPickerDialog, type PickerItem } from '@/components/item-picker-dialog'
import { buildPartyItems, needsMirror } from '@/lib/party-picker'
import { resolvePartyAction } from '@/app/actions/resolve-party'
import { QuickCreateSupplier } from '@/components/quick-create-forms'
import { createPurchaseReturnAction } from '@/app/actions/create-purchase-return'
import { FileUploader, type FileUploaderHandle } from '@/components/file-uploader'
import { YarnLineFields } from '@/components/yarn-line-fields'
import { StockPositionFields } from '@/components/stock-position-fields'
import type { StockPosition } from '@/lib/inventory/stock-position'
import type { GradeOption } from '@/app/actions/grades'
import { usesCartons, usesYarnFields, needsWeight, cartonStockQty, billingQty, billingUnitLabel, lineGrossAmount, normalizeFormula, ITEM_FORMULAS } from '@/lib/item-formula'
import { STANDARD_PROFILE, profileAt, type ItemProfile } from '@/lib/inventory/item-profiles'
import { RateBasisSelect } from '@/components/rate-basis-select'
import { todayPKT } from '@/lib/utils/dates'

const lineSchema = z.object({
  stockItemId: z.string().uuid('Select a stock item'),
  quantity:    z.number().positive('Enter quantity'),
  rate:        z.number().positive('Enter rate'),
  discountPct: z.number().min(0).max(100).default(0),
  yarnType:    z.string().optional().default(''),
  yarnWeight:  z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v), z.coerce.number().min(0).optional()),
  multiplyBy:  z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v), z.coerce.number().positive().optional()),
  // Carton-formula fields (per lb / per kg / per pack): they derive the quantity.
  nosCarton:       z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v), z.coerce.number().min(0).optional()),
  weightPerCarton: z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v), z.coerce.number().min(0).optional()),
  // Grade / lot, used only when the item type tracks them.
  gradeId:     z.string().nullable().optional(),
  lotNo:       z.string().nullable().optional(),
  // How the line is measured and billed (0074); defaults from the item.
  rateBasis:   z.enum(ITEM_FORMULAS).default('standard'),
})

const schema = z.object({
  purchaseOrderId: z.string().optional(),
  supplierId:      z.string().min(1, 'Supplier is required'),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  reason:          z.string().optional(),
  currencyCode:    z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:    z.number().positive().default(1),
  locationId:      z.string().optional(),
  lines:           z.array(lineSchema).min(1, 'Add at least one item'),
}).refine(
  (d) => d.currencyCode === 'PKR' || d.exchangeRate > 1,
  { message: 'Exchange Rate is required for USD', path: ['exchangeRate'] },
)

type FormValues = z.infer<typeof schema>

type PurchaseOrder = { id: string; date: string; supplierId: string; stockItemId: string; quantity: number; rate: number; currencyCode: string
  gradeId?: string | null; lotNo?: string | null; weightPerCarton?: number | null; rateBasis?: string | null }

type Props = {
  today:          string
  suppliers:      { id: string; name: string }[]
  customers?:     { id: string; name: string }[]
  lots:           { id: string; name: string; count: string; unitOfMeasure: string | null; profile?: ItemProfile }[]
  /** Tenant grades, for naming a line's grade. */
  grades?:            GradeOption[]
  /** On-hand stock per item × location × grade × lot. */
  positions?:         StockPosition[]
  purchaseOrders: PurchaseOrder[]
  locations:      { id: string; name: string }[]
}

export function CreatePurchaseReturnForm({ today, suppliers, customers = [], lots, purchaseOrders, locations, grades: initialGrades = [], positions = [] }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const uploaderRef = useRef<FileUploaderHandle>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      purchaseOrderId: '', supplierId: '', date: today, reason: '',
      currencyCode: 'PKR', exchangeRate: 1, locationId: '',
      lines: [{ stockItemId: '', quantity: NaN, rate: NaN, discountPct: 0, yarnType: '', yarnWeight: NaN, multiplyBy: 1, nosCarton: NaN, weightPerCarton: NaN, gradeId: null, lotNo: null, rateBasis: 'standard' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })

  const watchedCurrency     = form.watch('currencyCode')
  const watchedExchangeRate = form.watch('exchangeRate')
  const watchedLines        = form.watch('lines')
  const selectedPoId        = form.watch('purchaseOrderId')
  const watchedLocation     = form.watch('locationId')

  const er = watchedCurrency === 'USD' ? (watchedExchangeRate || 1) : 1

  const grades = initialGrades
  // Each item's formula profile comes from its item type (lib/item-formula.ts).
  const profileById = useMemo(() => new Map(lots.map((l) => [l.id, l.profile ?? STANDARD_PROFILE])), [lots])
  const profileFor = (id?: string) => (id && profileById.get(id)) || STANDARD_PROFILE
  // Each line's own rate basis decides its maths and grade / lot rules (0074).
  const basisOf = (l: { rateBasis?: string | null }) => normalizeFormula(l.rateBasis)
  const lineProfile = (l: { stockItemId?: string; rateBasis?: string | null }) => profileAt(profileFor(l.stockItemId), basisOf(l))
  // Pre-discount amount for a line, by its own rate basis.
  const lineGross = (l: {
    stockItemId?: string; quantity?: number | null; rate?: number | null; rateBasis?: string | null
    multiplyBy?: number | null; nosCarton?: number | null; weightPerCarton?: number | null
  }) => lineGrossAmount(basisOf(l), l, l.rate || 0, er)

  const { subtotal, discountTotal, netTotal } = useMemo(() => {
    const sub  = watchedLines.reduce((s, l) => s + lineGross(l), 0)
    const disc = watchedLines.reduce((s, l) => s + lineGross(l) * ((l.discountPct || 0) / 100), 0)
    return { subtotal: sub, discountTotal: disc, netTotal: sub - disc }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedLines, er, profileById])

  // Show the Nos Carton / Weight / Billed Qty columns only when a line needs them.
  const hasCarton = watchedLines.some((l) => usesCartons(basisOf(l)))

  // A carton line picks up its type's standard weight per pack while its weight
  // is still empty. Keyed on the item ids so it runs when an item is picked.
  const itemSig = watchedLines.map((l) => `${l.stockItemId ?? ''}:${l.rateBasis}`).join('|')
  useEffect(() => {
    watchedLines.forEach((l, i) => {
      const p = lineProfile(l)
      if (!usesCartons(p.formula) || !p.stdPackWeight) return
      if (Number.isFinite(Number(form.getValues(`lines.${i}.weightPerCarton`)))) return
      form.setValue(`lines.${i}.weightPerCarton`, p.stdPackWeight, { shouldDirty: true })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemSig, profileById])

  // For carton lines, Quantity is derived (Nos Carton × Weight; per pack: the
  // packs); keep the form field in sync so it drives validation. Keyed on a
  // value signature since watch() mutates the lines array in place.
  const cartonQtySig = watchedLines.map((l) => `${l.stockItemId ?? ''}:${l.rateBasis}:${l.nosCarton}:${l.weightPerCarton}`).join('|')
  useEffect(() => {
    watchedLines.forEach((l, i) => {
      const q = cartonStockQty(basisOf(l), l)
      if (q === null) return
      const cur = Number(form.getValues(`lines.${i}.quantity`))
      const next = q > 0 ? q : NaN
      const same = q > 0 ? cur === q : Number.isNaN(cur)
      if (!same) form.setValue(`lines.${i}.quantity`, next, { shouldDirty: true })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartonQtySig, profileById])

  // Line 1 of a return booked against an invoice line takes that line's grade
  // and lot (the server enforces it); show them instead of the pickers.
  const linkedOrder = purchaseOrders.find((o) => o.id === selectedPoId)
  const isLinkedLine = (index: number, stockItemId?: string) =>
    index === 0 && !!linkedOrder && linkedOrder.stockItemId === stockItemId
  const gradeName = (id?: string | null) => grades.find((g) => g.id === id)?.name

  const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 })

  const handlePoSelect = (poId: string) => {
    form.setValue('purchaseOrderId', poId)
    const po = purchaseOrders.find((o) => o.id === poId)
    if (po) {
      form.setValue('supplierId', po.supplierId)
      form.setValue('currencyCode', po.currencyCode as 'PKR' | 'USD')
      const lines = form.getValues('lines')
      if (lines.length === 1 && !lines[0].stockItemId) {
        form.setValue('lines.0.stockItemId', po.stockItemId)
        form.setValue('lines.0.rate', po.rate)
        if (po.weightPerCarton) form.setValue('lines.0.weightPerCarton', po.weightPerCarton)
        form.setValue('lines.0.gradeId', po.gradeId ?? null)
        form.setValue('lines.0.lotNo', po.lotNo ?? null)
        form.setValue('lines.0.rateBasis', normalizeFormula(po.rateBasis ?? profileFor(po.stockItemId).formula))
      }
    }
  }

  const [supplierList, setSupplierList] = useState<PickerItem[]>(
    suppliers.map((s) => ({ id: s.id, name: s.name }))
  )
  // Merged party list: customers + suppliers, each with an identity badge. Both
  // are selectable; a customer pick is mirrored to a supplier at save time.
  const supplierPickerItems = useMemo(
    () => buildPartyItems(customers, supplierList),
    [customers, supplierList],
  )
  const lotPickerItems = lots.map((l) => ({ id: l.id, name: l.name, badge: l.count, subType: l.profile?.subType }))

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)

      // If a customer was picked, mirror it to a supplier so supplier_id is valid.
      let supplierId = values.supplierId
      if (needsMirror(supplierId, supplierList.map((s) => s.id))) {
        const res = await resolvePartyAction({ partyId: supplierId, requiredType: 'supplier' })
        if (!res.success) { setServerError(res.error); return }
        supplierId = res.data.id
      }

      let firstEntryId: string | null = null
      for (let i = 0; i < values.lines.length; i++) {
        const line = values.lines[i]
        const effectiveRate = line.rate * (1 - (line.discountPct || 0) / 100)
        const result = await createPurchaseReturnAction({
          supplierId,
          stockItemId:     line.stockItemId,
          quantity:        line.quantity,
          rate:            effectiveRate,
          currencyCode:    values.currencyCode,
          exchangeRate:    values.exchangeRate,
          date:            values.date,
          purchaseOrderId: i === 0 ? values.purchaseOrderId || undefined : undefined,
          reason:          values.reason || undefined,
          locationId:      values.locationId || undefined,
          yarnType:        line.yarnType || undefined,
          yarnWeight:      Number.isFinite(line.yarnWeight) ? line.yarnWeight : undefined,
          multiplyBy:      Number.isFinite(line.multiplyBy) ? line.multiplyBy : undefined,
          nosCarton:       Number.isFinite(line.nosCarton) ? line.nosCarton : undefined,
          weightPerCarton: Number.isFinite(line.weightPerCarton) ? line.weightPerCarton : undefined,
          gradeId:         line.gradeId || undefined,
          lotNo:           line.lotNo?.trim() || undefined,
          rateBasis:       line.rateBasis,
        })
        if (!result.success) { setServerError(`Line ${i + 1}: ${result.error}`); return }
        if (i === 0) firstEntryId = result.data.id
      }
      if (firstEntryId) await uploaderRef.current?.uploadFiles(firstEntryId, 'purchase_return')
      router.push('/purchase-returns')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── FORM (left on xl) ── */}
          <div className="space-y-5">

            {/* Header card */}
            <Card>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base">Return Details</CardTitle>
              </CardHeader>
              {/* Purchase Order · Supplier · Date share one row on wide screens; Reason ·
                  Location · Currency fill the second. */}
              <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <FormItem className="md:col-span-4">
                  <FormLabel>Against Purchase Order (optional)</FormLabel>
                  <Select onValueChange={handlePoSelect} value={selectedPoId}>
                    <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="Select purchase order…" /></SelectTrigger>
                    <SelectContent>
                      {purchaseOrders.map((o) => {
                        const supplier = suppliers.find((s) => s.id === o.supplierId)
                        const lot = lots.find((l) => l.id === o.stockItemId)
                        return (
                          <SelectItem key={o.id} value={o.id}>
                            {o.date} — {supplier?.name ?? '?'} — {lot?.name ?? '?'} ({o.quantity} units)
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </FormItem>

                <FormField control={form.control} name="supplierId" render={({ field }) => (
                  <FormItem className="md:col-span-5">
                    <FormLabel>Supplier <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <ItemPickerDialog
                        items={supplierPickerItems}
                        value={field.value}
                        onSelect={field.onChange}
                        placeholder="Select supplier…"
                        title="Select Supplier"
                        createLabel="New Supplier"
                        onCreateSuccess={(item) => setSupplierList((prev) => [...prev, item])}
                        quickCreate={(onSuccess, onCancel) => (
                          <QuickCreateSupplier onSuccess={onSuccess} onCancel={onCancel} />
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Return Date <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="date" max={todayPKT()} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="reason" render={({ field }) => (
                  <FormItem className={locations.length > 0 ? 'md:col-span-5' : 'md:col-span-8'}>
                    <FormLabel>Reason</FormLabel>
                    <FormControl><Input placeholder="e.g. Defective, wrong item…" {...field} className="min-h-[44px]" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {locations.length > 0 && (
                  <FormField control={form.control} name="locationId" render={({ field }) => (
                    <FormItem className="md:col-span-3">
                      <FormLabel>Location</FormLabel>
                      <Select
                        value={field.value || '_none_'}
                        onValueChange={(v) => field.onChange(v === '_none_' ? '' : v)}
                      >
                        <FormControl>
                          <SelectTrigger className="min-h-[44px] w-full"><SelectValue placeholder="Select location (optional)…" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none_">No location</SelectItem>
                          {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <div className="flex gap-2 items-end md:col-span-4">
                  <FormField control={form.control} name="currencyCode" render={({ field }) => (
                    <FormItem className="w-28">
                      <FormLabel>Currency</FormLabel>
                      <Select value={field.value} onValueChange={(v) => { field.onChange(v); if (v === 'PKR') form.setValue('exchangeRate', 1) }}>
                        <FormControl>
                          <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PKR">PKR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  {watchedCurrency === 'USD' && (
                    <FormField control={form.control} name="exchangeRate" render={() => (
                      <FormItem className="flex-1">
                        <FormLabel>Rate (1 USD = ? PKR) <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="1" placeholder="e.g. 278.50"
                            {...form.register('exchangeRate', { valueAsNumber: true })} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Line items card */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-base">Return Items</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="line-table w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-8">#</th>
                          <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Item</th>
                          {hasCarton && <>
                            <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-28">Nos Carton</th>
                            <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-28">Weight (kg)</th>
                          </>}
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-40">{hasCarton ? 'Quantity' : 'Qty'}</th>
                          {hasCarton && (
                            <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-32">Billed Qty</th>
                          )}
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-36">Rate</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-24">Disc %</th>
                          <th className="text-right px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-32">Amount</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {fields.map((field, index) => {
                          const line   = watchedLines[index] ?? {}
                          const profile = lineProfile(line)
                          const isYarnLine = usesYarnFields(profile.formula)
                          const isCartonLine = usesCartons(profile.formula)
                          const tracksStock = profile.trackGrade || profile.trackLot
                          const billed = billingQty(profile.formula, line)
                          const stockQty = cartonStockQty(profile.formula, line) ?? 0
                          const amount = lineGross(line) * (1 - (line.discountPct || 0) / 100)
                          const colSpan = hasCarton ? 9 : 6
                          return (
                            <React.Fragment key={field.id}>
                            <tr className="align-top">
                              <td className="px-3 py-3 text-muted-foreground text-xs">{index + 1}</td>
                              <td className="px-3 py-2 min-w-[240px]">
                                <Controller
                                  control={form.control}
                                  name={`lines.${index}.stockItemId`}
                                  render={({ field: f, fieldState }) => (
                                    <div>
                                      <ItemPickerDialog
                                        items={lotPickerItems}
                                        value={f.value}
                                        onSelect={(id) => {
                                          f.onChange(id)
                                          // A new item starts on the basis last used for it.
                                          form.setValue(`lines.${index}.rateBasis`, profileFor(id).formula, { shouldDirty: true })
                                        }}
                                        placeholder="Select item…"
                                        title="Select Stock Item"
                                      />
                                      {fieldState.error && <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>}
                                      <div className="mt-1.5">
                                        <RateBasisSelect
                                          value={line.rateBasis}
                                          onChange={(b) => form.setValue(`lines.${index}.rateBasis`, b, { shouldDirty: true })}
                                        />
                                      </div>
                                    </div>
                                  )}
                                />
                              </td>
                              {hasCarton && (isCartonLine ? <>
                                <td className="px-3 py-2">
                                  <NumericInput min={0} step="0.0001" placeholder="" className="text-right"
                                    {...form.register(`lines.${index}.nosCarton`, { valueAsNumber: true })} />
                                </td>
                                <td className="px-3 py-2">
                                  <NumericInput min={0} step="0.0001" placeholder={needsWeight(profile.formula) ? '' : 'optional'} className="text-right"
                                    {...form.register(`lines.${index}.weightPerCarton`, { valueAsNumber: true })} />
                                </td>
                              </> : <>
                                <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                                <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                              </>)}
                              <td className="px-3 py-2">
                                {isCartonLine ? (
                                  <div title={profile.formula === 'per_pack' ? 'Auto = Nos Carton' : 'Auto = Nos Carton × Weight'}
                                    className="flex h-9 items-center justify-end rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
                                    {stockQty > 0 ? stockQty.toLocaleString('en-PK', { maximumFractionDigits: 4 }) : '—'}
                                  </div>
                                ) : (
                                  <NumericInput min={0} step="0.0001" placeholder="" className="text-right"
                                    {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })} />
                                )}
                                {form.formState.errors.lines?.[index]?.quantity && (
                                  <p className="text-xs text-destructive mt-1">{form.formState.errors.lines[index]?.quantity?.message}</p>
                                )}
                                {(() => { const uom = lots.find(l => l.id === line.stockItemId)?.unitOfMeasure; return uom ? <p className="text-xs text-muted-foreground mt-0.5 text-right">{uom}</p> : null })()}
                              </td>
                              {hasCarton && (isCartonLine
                                ? <td className="px-3 py-2 text-right tabular-nums pt-3 text-muted-foreground">
                                    {billed > 0 ? billed.toLocaleString('en-PK', { maximumFractionDigits: 4 }) : '—'}
                                    <p className="text-xs mt-0.5">{billingUnitLabel(profile.formula, profile.packUnit)}</p>
                                  </td>
                                : <td className="px-3 py-2 text-right text-muted-foreground">—</td>)}
                              <td className="px-3 py-2">
                                <NumericInput min={0} step="0.0001" placeholder="" className="text-right"
                                  {...form.register(`lines.${index}.rate`, { valueAsNumber: true })} />
                                {form.formState.errors.lines?.[index]?.rate && (
                                  <p className="text-xs text-destructive mt-1">{form.formState.errors.lines[index]?.rate?.message}</p>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <NumericInput min={0} max={100} step="0.1" placeholder="0" className="text-right"
                                  {...form.register(`lines.${index}.discountPct`, { valueAsNumber: true })} />
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums pt-3 font-medium">
                                {amount > 0 ? `Rs ${fmt(amount)}` : '—'}
                              </td>
                              <td className="px-1 py-2 pt-2">
                                <Button type="button" variant="ghost" size="icon-sm"
                                  onClick={() => remove(index)} disabled={fields.length === 1}
                                  className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="size-4" />
                                </Button>
                              </td>
                            </tr>
                            {tracksStock && (
                              <tr>
                                <td />
                                <td colSpan={colSpan} className="px-3 pb-3">
                                  {isLinkedLine(index, line.stockItemId) ? (
                                    <p className="text-xs text-muted-foreground">
                                      From the purchase line: {[
                                        profile.trackGrade ? `Grade ${gradeName(linkedOrder?.gradeId) ?? '—'}` : null,
                                        profile.trackLot ? `Lot ${linkedOrder?.lotNo ?? '—'}` : null,
                                      ].filter(Boolean).join(' · ')}
                                    </p>
                                  ) : (
                                    <StockPositionFields
                                      positions={positions}
                                      stockItemId={line.stockItemId}
                                      locationId={watchedLocation || null}
                                      grades={grades}
                                      trackGrade={profile.trackGrade}
                                      trackLot={profile.trackLot}
                                      gradeId={line.gradeId}
                                      lotNo={line.lotNo}
                                      stockUnit={profile.stockUnit}
                                      packUnit={profile.packUnit}
                                      onChange={(next) => {
                                        form.setValue(`lines.${index}.gradeId`, next.gradeId, { shouldDirty: true })
                                        form.setValue(`lines.${index}.lotNo`, next.lotNo, { shouldDirty: true })
                                      }}
                                    />
                                  )}
                                </td>
                              </tr>
                            )}
                            {isYarnLine && (
                              <tr>
                                <td />
                                <td colSpan={colSpan} className="px-3 pb-3">
                                  <YarnLineFields index={index} />
                                </td>
                              </tr>
                            )}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-3">
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => append({ stockItemId: '', quantity: NaN, rate: NaN, discountPct: 0, yarnType: '', yarnWeight: NaN, multiplyBy: 1, nosCarton: NaN, weightPerCarton: NaN, gradeId: null, lotNo: null, rateBasis: 'standard' })}
                    className="gap-1.5">
                    <Plus className="size-4" /> Add Line
                  </Button>
                </div>
                {form.formState.errors.lines?.message && (
                  <p className="text-xs text-destructive mt-2">{form.formState.errors.lines.message as string}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className=" xl:sticky xl:top-6 space-y-4">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Return Summary</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items ({fields.length})</span>
                    <span className="tabular-nums font-medium">Rs {fmt(subtotal)}</span>
                  </div>
                  {discountTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="tabular-nums font-medium text-rose-600">− Rs {fmt(discountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net Amount</span>
                    <span className="tabular-nums font-medium">Rs {fmt(netTotal)}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center mb-5">
                  <span className="font-bold text-sm">Total</span>
                  <span className="text-xl font-extrabold tabular-nums tracking-tight">Rs {fmt(netTotal)}</span>
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
                    disabled={isPending}>
                    {isPending ? 'Saving…' : `Confirm Return${fields.length > 1 ? ` (${fields.length} items)` : ''}`}
                  </Button>
                  <ExitButton
                    isDirty={form.formState.isDirty}
                    onExit={() => router.back()}
                    className="w-full min-h-[44px]"
                  />
                </div>

                {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}

                <div className="mt-4 pt-4 border-t">
                  <FileUploader ref={uploaderRef} />
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </form>
    </Form>
  )
}
