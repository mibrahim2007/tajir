'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { editInventoryLotAction } from '@/app/actions/edit-inventory-lot'
import { ItemTypeSelectItems } from '@/components/item-type-select-items'

const UOM_OPTIONS = ['KG', 'Cone', 'Meter', 'Yard', 'Roll', 'Bag', 'Bale', 'Piece', 'Bundle'] as const

const schema = z.object({
  name:          z.string().min(1, 'Name is required'),
  sku:           z.string().trim().min(1, 'SKU is required').max(64, 'SKU too long'),
  code:          z.string().optional(),
  count:         z.string().optional(),
  unitOfMeasure: z.string().optional(),
  itemTypeId:    z.string().uuid().optional(),
  fiber:         z.string().optional(),
  lot:           z.string().optional(),
})

type FormValues = z.infer<typeof schema>
type ItemType = { id: string; name: string; parentId?: string | null }

type Lot = {
  id: string
  name: string
  sku: string
  code: string | null
  count: string
  unitOfMeasure: string | null
  itemTypeId: string | null
  fiber: string | null
  lot: string | null
}

// Full-page form at /inventory/[id]/edit (was a drawer on the inventory list).
export function EditInventoryLotForm({ lot, itemTypes }: { lot: Lot; itemTypes: ItemType[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:          lot.name,
      sku:           lot.sku,
      code:          lot.code ?? '',
      count:         lot.count,
      unitOfMeasure: lot.unitOfMeasure ?? undefined,
      itemTypeId:    lot.itemTypeId ?? undefined,
      fiber:         lot.fiber ?? '',
      lot:           lot.lot ?? '',
    },
  })

  const watched = form.watch()
  const typeName = itemTypes.find((t) => t.id === watched.itemTypeId)?.name

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editInventoryLotAction({ id: lot.id, ...values })
      if (!result.success) { setError(result.error); return }
      // Back to the list, which re-renders with the change. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push('/inventory')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── FORM (left on xl) ── */}
          <Card className="min-w-0">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">Stock Item Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sku" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>SKU / Barcode <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input className="font-mono" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Code</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="count" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Count</FormLabel>
                  <FormControl><Input type="number" inputMode="decimal" placeholder="e.g. 10" {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Unit of Measure</FormLabel>
                  <Select
                    value={field.value ?? '_none_'}
                    onValueChange={(v) => field.onChange(v === '_none_' ? undefined : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="min-h-[44px] w-full">
                        <SelectValue placeholder="Select unit…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none_">No unit</SelectItem>
                      {UOM_OPTIONS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="itemTypeId" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Item Type</FormLabel>
                  <Select
                    value={field.value ?? '_none_'}
                    onValueChange={(v) => field.onChange(v === '_none_' ? undefined : v)}
                    disabled={itemTypes.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className="min-h-[44px] w-full">
                        <SelectValue placeholder={itemTypes.length === 0 ? 'No types defined' : 'Select type…'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none_">No type</SelectItem>
                      <ItemTypeSelectItems itemTypes={itemTypes} keepSelectableId={lot.itemTypeId} />
                    </SelectContent>
                  </Select>
                  {itemTypes.length === 0 && (
                    <p className="text-xs text-muted-foreground">Add item types in Settings → Item Types</p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="fiber" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Fiber</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lot" render={({ field }) => (
                <FormItem className="md:col-span-6">
                  <FormLabel>Lot</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className="xl:sticky xl:top-6">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Stock Item Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-right truncate">{watched.name || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Type</span>
                    <span className="text-right truncate">{typeName ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit</span>
                    <span>{watched.unitOfMeasure ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Count · Lot</span>
                    <span className="text-right truncate">{[watched.count, watched.lot].filter(Boolean).join(' · ') || '—'}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between gap-3 mb-5 text-sm">
                  <span className="text-muted-foreground">SKU</span>
                  <span className="font-mono truncate">{watched.sku || '—'}</span>
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                    {isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/inventory')}>
                    Cancel
                  </Button>
                </div>

                {error && <p className="text-sm text-destructive mt-3">{error}</p>}
              </CardContent>
            </Card>
          </div>

        </div>
      </form>
    </Form>
  )
}
