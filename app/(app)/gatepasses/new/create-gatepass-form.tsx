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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { createGatepassAction } from '@/app/actions/create-gatepass'

const lineSchema = z.object({
  orderId: z.string().min(1, 'Select an entry'),
})

const schema = z.object({
  gateppassNumber: z.string().min(1, 'Gatepass number is required'),
  type: z.enum(['purchase', 'sale']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  vehicleNumber: z.string().min(1, 'Vehicle number is required'),
  driverName: z.string().min(1, 'Driver name is required'),
  remarks: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'Add at least one entry'),
})

type FormValues = z.infer<typeof schema>

export type PurchaseOrderOption = { id: string; supplierName: string; stockItemName: string; quantity: string; date: string }
export type SalesOrderOption = { id: string; customerName: string; stockItemName: string; quantity: string; date: string }

type Props = {
  today: string
  purchaseOrders: PurchaseOrderOption[]
  salesOrders: SalesOrderOption[]
}

export function CreateGatepassForm({ today, purchaseOrders, salesOrders }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      gateppassNumber: '',
      type: 'purchase',
      date: today,
      vehicleNumber: '',
      driverName: '',
      remarks: '',
      lines: [{ orderId: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })

  const watchType = form.watch('type')
  const watchedLines = form.watch('lines')

  const purchasePickerItems = purchaseOrders.map((o) => ({
    id: o.id,
    name: `${o.supplierName} — ${o.stockItemName}`,
    badge: o.date,
    meta: `Qty: ${o.quantity}`,
  }))

  const salesPickerItems = salesOrders.map((o) => ({
    id: o.id,
    name: `${o.customerName} — ${o.stockItemName}`,
    badge: o.date,
    meta: `Qty: ${o.quantity}`,
  }))

  const pickerItems = watchType === 'purchase' ? purchasePickerItems : salesPickerItems
  const pickerTitle = watchType === 'purchase' ? 'Select Purchase Entry' : 'Select Sale Entry'
  const pickerPlaceholder = watchType === 'purchase' ? 'Select purchase entry…' : 'Select sale entry…'
  const ordersEmpty = watchType === 'purchase' ? purchaseOrders.length === 0 : salesOrders.length === 0

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
      for (let i = 0; i < values.lines.length; i++) {
        const line = values.lines[i]
        const result = await createGatepassAction({
          gateppassNumber: values.lines.length > 1 ? `${values.gateppassNumber}/${i + 1}` : values.gateppassNumber,
          type: values.type,
          purchaseOrderId: values.type === 'purchase' ? line.orderId : undefined,
          salesOrderId: values.type === 'sale' ? line.orderId : undefined,
          date: values.date,
          vehicleNumber: values.vehicleNumber,
          driverName: values.driverName,
          remarks: values.remarks || undefined,
        })
        if (!result.success) { setServerError(`Entry ${i + 1}: ${result.error}`); return }
      }
      router.push('/gatepasses')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Header */}
        <Card>
          <CardHeader className="pb-4 pt-5 px-5">
            <CardTitle className="text-base">Gatepass Details</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="gateppassNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Gatepass No. <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="e.g. GP-001" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
                {fields.length > 1 && (
                  <p className="text-xs text-muted-foreground">Multiple entries will be numbered GP-001/1, GP-001/2…</p>
                )}
              </FormItem>
            )} />

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
                <FormLabel>Vehicle Number <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="e.g. ABC-1234" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="driverName" render={({ field }) => (
              <FormItem>
                <FormLabel>Driver Name <span className="text-destructive">*</span></FormLabel>
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

        {/* Entries (lines) */}
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
                    <span className="text-xs text-muted-foreground pt-3 w-5 shrink-0">{index + 1}</span>
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
                    <Button
                      type="button" variant="ghost" size="icon-sm"
                      onClick={() => remove(index)} disabled={fields.length === 1}
                      className="text-muted-foreground hover:text-destructive mt-1 shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )
              })}
            </div>

            <Button
              type="button" variant="outline" size="sm"
              onClick={() => append({ orderId: '' })}
              className="mt-3 gap-1.5"
              disabled={ordersEmpty}
            >
              <Plus className="size-4" /> Add Entry
            </Button>
            {ordersEmpty && (
              <p className="text-xs text-muted-foreground mt-2">
                No {watchType} entries found.
              </p>
            )}
          </CardContent>
        </Card>

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 min-h-[44px]" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" className="flex-1 min-h-[44px]" disabled={isPending}>
            {isPending ? 'Saving…' : `Issue Gatepass${fields.length > 1 ? ` (${fields.length} entries)` : ''}`}
          </Button>
        </div>
      </form>
    </Form>
  )
}
