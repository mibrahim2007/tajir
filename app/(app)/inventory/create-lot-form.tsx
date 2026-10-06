'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { createInventoryLotAction } from '@/app/actions/create-inventory-lot'
import { createLotSchema, type CreateLotInput } from '@/app/actions/inventory-lot-schema'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'
import { ItemTypeSelectItems } from '@/components/item-type-select-items'

const UOM_OPTIONS = ['KG', 'Cone', 'Meter', 'Yard', 'Roll', 'Bag', 'Bale', 'Piece', 'Bundle'] as const

type ItemType = { id: string; name: string; parentId?: string | null }

// Full-page form at /inventory/new (was a drawer on the inventory list).
export function CreateLotForm({ itemTypes }: { itemTypes: ItemType[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()
  const [showDuplicateLotDialog, setShowDuplicateLotDialog] = useState(false)
  const [pendingValues, setPendingValues] = useState<CreateLotInput | null>(null)

  const form = useForm<CreateLotInput>({
    resolver: zodResolver(createLotSchema),
    defaultValues: {
      name: '',
      itemNature: 'inventory',
      sku: '',
      code: '',
      count: '',
      unitOfMeasure: undefined,
      itemTypeId: undefined,
      fiber: '',
      lot: '',
      defaultSupplierId: undefined,
      confirmDuplicateLot: false,
    },
  })

  const isService = form.watch('itemNature') === 'service'
  const watched = form.watch()
  const typeName = itemTypes.find((t) => t.id === watched.itemTypeId)?.name

  const submit = (values: CreateLotInput, confirm = false) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createInventoryLotAction({ ...values, confirmDuplicateLot: confirm })

      if (!result.success) {
        if (result.code === 'LOT_DUPLICATE') {
          setPendingValues(values)
          setShowDuplicateLotDialog(true)
          return
        }
        setServerError(result.error)
        return
      }

      // Back to the list, which re-renders with the new item. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push('/inventory')
    })
  }

  const onSubmit = (values: CreateLotInput) => submit(values, false)

  const handleConfirmDuplicate = () => {
    setShowDuplicateLotDialog(false)
    if (pendingValues) submit(pendingValues, true)
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext}>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

            {/* ── FORM (left on xl) ── */}
            <Card className="min-w-0">
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base">Stock Item Details</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-6">
                      <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Super Fine 30s Combed" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="itemNature"
                  render={({ field }) => (
                    <FormItem className="md:col-span-3">
                      <FormLabel>Item Nature <span className="text-destructive">*</span></FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="min-h-[44px] w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="inventory">Inventory (stockable)</SelectItem>
                          <SelectItem value="service">Service (non-stockable)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {isService
                          ? 'Not stocked. Use for charges like freight — sold without a location and with no effect on inventory.'
                          : 'Stockable goods tracked by quantity and location.'}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem className="md:col-span-4">
                      <FormLabel>SKU / Barcode</FormLabel>
                      <FormControl>
                        <Input placeholder="Auto-generated (e.g. TJR-000123)" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Leave blank to auto-assign the next code.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem className="md:col-span-4">
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. SF30C" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isService && (
                <FormField
                  control={form.control}
                  name="count"
                  render={({ field }) => (
                    <FormItem className="md:col-span-4">
                      <FormLabel>Count</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="decimal" placeholder="e.g. 10" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                )}

                <FormField
                  control={form.control}
                  name="unitOfMeasure"
                  render={({ field }) => (
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
                  )}
                />

                <FormField
                  control={form.control}
                  name="itemTypeId"
                  render={({ field }) => (
                    <FormItem className="md:col-span-4">
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
                          <ItemTypeSelectItems itemTypes={itemTypes} />
                        </SelectContent>
                      </Select>
                      {itemTypes.length === 0 && (
                        <p className="text-xs text-muted-foreground">Add item types in Settings → Item Types</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isService && (
                <FormField
                  control={form.control}
                  name="fiber"
                  render={({ field }) => (
                    <FormItem className="md:col-span-4">
                      <FormLabel>Fiber</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Cotton, Polyester" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                )}

                {!isService && (
                <FormField
                  control={form.control}
                  name="lot"
                  render={({ field }) => (
                    <FormItem className="md:col-span-4">
                      <FormLabel>Lot</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. L-2024-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                )}

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
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nature</span>
                      <span>{isService ? 'Service' : 'Inventory'}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Type</span>
                      <span className="text-right truncate">{typeName ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unit</span>
                      <span>{watched.unitOfMeasure ?? '—'}</span>
                    </div>
                    {!isService && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Count · Lot</span>
                        <span className="text-right truncate">{[watched.count, watched.lot].filter(Boolean).join(' · ') || '—'}</span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div className="flex justify-between gap-3 mb-5 text-sm">
                    <span className="text-muted-foreground">SKU</span>
                    <span className="font-mono">{watched.sku || 'Auto'}</span>
                  </div>

                  <div className="space-y-2">
                    <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                      {isPending ? 'Creating…' : 'Create Stock Item'}
                    </Button>
                    <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/inventory')}>
                      Cancel
                    </Button>
                  </div>

                  {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}
                </CardContent>
              </Card>
            </div>

          </div>
        </form>
      </Form>

      <Dialog open={showDuplicateLotDialog} onOpenChange={setShowDuplicateLotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lot already exists</DialogTitle>
            <DialogDescription>
              A stock item with Lot &ldquo;{pendingValues?.lot}&rdquo; already exists. Do you want
              to create a new entry with the same lot number, or cancel and enter a different lot?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateLotDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDuplicate} disabled={isPending}>
              Create New
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
