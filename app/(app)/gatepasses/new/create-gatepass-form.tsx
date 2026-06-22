'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, type Resolver, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { createGatepassAction } from '@/app/actions/create-gatepass'

const lineSchema = z.object({
  orderId: z.string().min(1, 'Select an entry'),
})

const schema = z.object({
  type:          z.enum(['purchase', 'sale']),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  vehicleNumber: z.string().optional(),
  driverName:    z.string().optional(),
  remarks:       z.string().optional(),
  lines:         z.array(lineSchema).min(1, 'Add at least one entry'),
})

type FormValues = z.infer<typeof schema>

export type PurchaseOrderOption = { id: string; supplierName: string; stockItemName: string; quantity: string; date: string }
export type SalesOrderOption    = { id: string; customerName: string; stockItemName: string; quantity: string; date: string }

type Props = {
  today:          string
  nextGpNumber:   string
  purchaseOrders: PurchaseOrderOption[]
  salesOrders:    SalesOrderOption[]
}

export function CreateGatepassForm({ today, nextGpNumber, purchaseOrders, salesOrders }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      type: 'purchase', date: today,
      vehicleNumber: '', driverName: '', remarks: '',
      lines: [{ orderId: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })

  const watchType    = form.watch('type')
  const watchedLines = form.watch('lines')
  const watchedDate  = form.watch('date')
  const watchedVehicle  = form.watch('vehicleNumber')
  const watchedDriver   = form.watch('driverName')

  const purchasePickerItems = purchaseOrders.map((o) => ({
    id: o.id, name: `${o.supplierName} — ${o.stockItemName}`, badge: o.date, meta: `Qty: ${o.quantity}`,
  }))
  const salesPickerItems = salesOrders.map((o) => ({
    id: o.id, name: `${o.customerName} — ${o.stockItemName}`, badge: o.date, meta: `Qty: ${o.quantity}`,
  }))

  const pickerItems       = watchType === 'purchase' ? purchasePickerItems : salesPickerItems
  const pickerTitle       = watchType === 'purchase' ? 'Select Purchase Entry' : 'Select Sale Entry'
  const pickerPlaceholder = watchType === 'purchase' ? 'Select purchase entry…' : 'Select sale entry…'
  const ordersEmpty       = watchType === 'purchase' ? purchaseOrders.length === 0 : salesOrders.length === 0

  const handleTypeChange = (value: string) => {
    form.setValue('type', value as 'purchase' | 'sale')
    form.setValue('lines', [{ orderId: '' }])
  }

  const getOrderLabel = (orderId: string) => {
    if (watchType === 'purchase') {
      const o = purchaseOrders.find((p) => p.id === orderId)
      return o ? `${o.date} · ${o.supplierName} · ${o.stockItemName} (${o.quantity})` : orderId
    }
    const o = salesOrders.find((s) => s.id === orderId)
    return o ? `${o.date} · ${o.customerName} · ${o.stockItemName} (${o.quantity})` : orderId
  }

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createGatepassAction({
        type:          values.type,
        date:          values.date,
        vehicleNumber: values.vehicleNumber,
        driverName:    values.driverName,
        remarks:       values.remarks,
        lines:         values.lines,
      })
      if (!result.success) { setServerError(result.error); return }
      router.push('/gatepasses')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">

            {/* Header card */}
            <Card>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base">Gatepass Details</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
                {/* Auto-generated GP number — read only */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Gatepass No.</span>
                  <div className="min-h-[44px] flex items-center px-3 rounded-md border bg-muted/50 font-mono text-sm font-semibold tracking-wide text-foreground">
                    {nextGpNumber}
                  </div>
                  <p className="text-xs text-muted-foreground">Auto-assigned on save</p>
                </div>

                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                    <Select value={field.value} onValueChange={handleTypeChange}>
                      <FormControl>
                        <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="purchase">Purchase</SelectItem>
                        <SelectItem value="sale">Sale</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gatepass Date <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="vehicleNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Number</FormLabel>
                    <FormControl><Input placeholder="e.g. ABC-1234" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="driverName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver Name</FormLabel>
                    <FormControl><Input placeholder="Driver's full name" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="remarks" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl><Input placeholder="Optional notes…" className="min-h-[44px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Detail lines card */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-base">
                  {watchType === 'purchase' ? 'Purchase' : 'Sale'} Entries
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="space-y-2">
                  {fields.map((field, index) => {
                    const orderId = watchedLines[index]?.orderId ?? ''
                    return (
                      <div key={field.id} className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground pt-3 w-5 shrink-0 tabular-nums">{index + 1}</span>
                        <div className="flex-1">
                          <Controller
                            control={form.control}
                            name={`lines.${index}.orderId`}
                            render={({ field: f, fieldState }) => (
                              <div>
                                <ItemPickerDialog
                                  items={pickerItems}
                                  value={f.value}
                                  onSelect={f.onChange}
                                  placeholder={pickerPlaceholder}
                                  title={pickerTitle}
                                  disabled={ordersEmpty}
                                />
                                {fieldState.error && <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>}
                                {orderId && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{getOrderLabel(orderId)}</p>
                                )}
                              </div>
                            )}
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon-sm"
                          onClick={() => remove(index)} disabled={fields.length === 1}
                          className="text-muted-foreground hover:text-destructive mt-1 shrink-0">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>

                <Button type="button" variant="outline" size="sm"
                  onClick={() => append({ orderId: '' })}
                  className="mt-3 gap-1.5" disabled={ordersEmpty}>
                  <Plus className="size-4" /> Add Entry
                </Button>
                {ordersEmpty && (
                  <p className="text-xs text-muted-foreground mt-2">No {watchType} entries available.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT COLUMN — sticky summary ── */}
          <div className="lg:sticky lg:top-6">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Gatepass Summary</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">No.</span>
                    <span className="font-mono font-semibold text-primary">{nextGpNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      watchType === 'purchase'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    }`}>
                      {watchType === 'purchase' ? 'Purchase' : 'Sale'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium tabular-nums">{watchedDate || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle</span>
                    <span className="font-medium">{watchedVehicle || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Driver</span>
                    <span className="font-medium">{watchedDriver || '—'}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center mb-5">
                  <span className="font-bold text-sm">Entries</span>
                  <span className="text-xl font-extrabold tabular-nums tracking-tight">{fields.length}</span>
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
                    disabled={isPending}>
                    {isPending ? 'Saving…' : 'Issue Gatepass'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]"
                    onClick={() => router.back()}>
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
  )
}
