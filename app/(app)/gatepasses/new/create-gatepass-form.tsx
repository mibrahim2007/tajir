'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { createGatepassAction } from '@/app/actions/create-gatepass'

const schema = z.object({
  gateppassNumber: z.string().min(1, 'Gatepass number is required'),
  type:            z.enum(['purchase', 'sale']),
  purchaseOrderId: z.string().optional(),
  salesOrderId:    z.string().optional(),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  vehicleNumber:   z.string().min(1, 'Vehicle number is required'),
  driverName:      z.string().min(1, 'Driver name is required'),
  remarks:         z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.type === 'purchase' && !d.purchaseOrderId) {
    ctx.addIssue({ code: 'custom', path: ['purchaseOrderId'], message: 'Select a purchase entry' })
  }
  if (d.type === 'sale' && !d.salesOrderId) {
    ctx.addIssue({ code: 'custom', path: ['salesOrderId'], message: 'Select a sale entry' })
  }
})

type FormValues = z.infer<typeof schema>

export type PurchaseOrderOption = {
  id: string
  supplierName: string
  stockItemName: string
  quantity: string
  date: string
}

export type SalesOrderOption = {
  id: string
  customerName: string
  stockItemName: string
  quantity: string
  date: string
}

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
      purchaseOrderId: '',
      salesOrderId: '',
      date: today,
      vehicleNumber: '',
      driverName: '',
      remarks: '',
    },
  })

  const watchType = form.watch('type')
  const watchPurchaseOrderId = form.watch('purchaseOrderId')
  const watchSalesOrderId = form.watch('salesOrderId')

  const entryDate =
    watchType === 'purchase'
      ? purchaseOrders.find((o) => o.id === watchPurchaseOrderId)?.date
      : salesOrders.find((o) => o.id === watchSalesOrderId)?.date

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

  const handleTypeChange = (value: string) => {
    form.setValue('type', value as 'purchase' | 'sale')
    form.setValue('purchaseOrderId', '')
    form.setValue('salesOrderId', '')
    form.clearErrors(['purchaseOrderId', 'salesOrderId'])
  }

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createGatepassAction(values)
      if (!result.success) { setServerError(result.error); return }
      router.push('/gatepasses')
    })
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

            {/* Gatepass Number */}
            <FormField control={form.control} name="gateppassNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Gatepass No. <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="e.g. GP-001" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Type */}
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                <Select value={field.value} onValueChange={handleTypeChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="purchase">Purchase</SelectItem>
                    <SelectItem value="sale">Sale</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Purchase order picker */}
            {watchType === 'purchase' && (
              <FormField control={form.control} name="purchaseOrderId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Entry <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <ItemPickerDialog
                      items={purchasePickerItems}
                      value={field.value ?? ''}
                      onSelect={field.onChange}
                      placeholder="Select purchase entry…"
                      title="Select Purchase Entry"
                      disabled={purchaseOrders.length === 0}
                    />
                  </FormControl>
                  <FormMessage />
                  {purchaseOrders.length === 0 && (
                    <p className="text-xs text-muted-foreground">No purchase entries found.</p>
                  )}
                </FormItem>
              )} />
            )}

            {/* Sales order picker */}
            {watchType === 'sale' && (
              <FormField control={form.control} name="salesOrderId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sale Entry <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <ItemPickerDialog
                      items={salesPickerItems}
                      value={field.value ?? ''}
                      onSelect={field.onChange}
                      placeholder="Select sale entry…"
                      title="Select Sale Entry"
                      disabled={salesOrders.length === 0}
                    />
                  </FormControl>
                  <FormMessage />
                  {salesOrders.length === 0 && (
                    <p className="text-xs text-muted-foreground">No sale entries found.</p>
                  )}
                </FormItem>
              )} />
            )}

            {/* Entry date (auto-populated, display only) */}
            {entryDate && (
              <div className="rounded-md border bg-muted/50 px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">Entry Date: </span>
                <span className="font-medium">{entryDate}</span>
              </div>
            )}

            {/* Gatepass date */}
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel>Gatepass Date <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Vehicle Number */}
            <FormField control={form.control} name="vehicleNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Number <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="e.g. ABC-1234" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Driver Name */}
            <FormField control={form.control} name="driverName" render={({ field }) => (
              <FormItem>
                <FormLabel>Driver Name <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Driver's full name" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Remarks */}
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem>
                <FormLabel>Remarks</FormLabel>
                <FormControl><Input placeholder="Optional notes…" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 min-h-[44px]" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 min-h-[44px]" disabled={isPending}>
                {isPending ? 'Saving…' : 'Issue Gatepass'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
