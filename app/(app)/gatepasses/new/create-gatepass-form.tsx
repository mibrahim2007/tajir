'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExitButton } from '@/components/exit-button'
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
  orderId:  z.string().min(1, 'Select an order'),
  quantity: z.number().positive('Quantity must be positive'),
})

const schema = z.object({
  type:          z.enum(['purchase', 'sale']),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  vehicleNumber: z.string().optional(),
  driverName:    z.string().optional(),
  remarks:       z.string().optional(),
  lines:         z.array(lineSchema).min(1, 'Add at least one item'),
})

type FormValues = z.infer<typeof schema>

export type OrderOption = {
  id:            string
  date:          string
  stockItemId:   string
  stockItemName: string
  partyName:     string
  orderQty:      number
  balance:       number
}

type Props = {
  today:          string
  nextGpNumber:   string
  purchaseOrders: OrderOption[]
  salesOrders:    OrderOption[]
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
      lines: [{ orderId: '', quantity: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })

  const watchType    = form.watch('type')
  const watchedLines = form.watch('lines')
  const watchedDate  = form.watch('date')
  const watchedVehicle = form.watch('vehicleNumber')
  const watchedDriver  = form.watch('driverName')

  const currentOrders = watchType === 'purchase' ? purchaseOrders : salesOrders

  /* Balance map for quick lookup */
  const balanceMap = new Map(currentOrders.map(o => [o.id, o.balance]))
  const orderMap   = new Map(currentOrders.map(o => [o.id, o]))

  /* Picker items: stock item name as title, party + date as meta, balance as badge */
  const pickerItems = currentOrders.map(o => ({
    id:    o.id,
    name:  o.stockItemName,
    badge: `Bal: ${o.balance.toLocaleString(undefined, { maximumFractionDigits: 3 })}`,
    meta:  `${o.partyName} · ${o.date}`,
  }))

  const pickerTitle       = watchType === 'purchase' ? 'Select Purchase Order' : 'Select Sale Order'
  const pickerPlaceholder = watchType === 'purchase' ? 'Pick purchase order…' : 'Pick sale order…'
  const ordersEmpty       = currentOrders.length === 0

  const totalQty = watchedLines.reduce((s, l) => s + (l.quantity || 0), 0)

  const handleTypeChange = (value: string) => {
    form.setValue('type', value as 'purchase' | 'sale')
    form.setValue('lines', [{ orderId: '', quantity: 0 }])
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
                        <SelectItem value="purchase">Purchase (Inward)</SelectItem>
                        <SelectItem value="sale">Sale (Outward)</SelectItem>
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

            {/* Line items card */}
            <Card>
              <CardHeader className="pb-2 pt-5 px-5">
                <CardTitle className="text-base">
                  {watchType === 'purchase' ? 'Purchase Orders' : 'Sale Orders'} — Pending Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">

                {ordersEmpty ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No {watchType} orders with pending balance. All orders are fully {watchType === 'purchase' ? 'received' : 'dispatched'}.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto -mx-5">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="w-8 px-3 py-2 text-left text-xs text-muted-foreground font-medium" />
                            <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">Order</th>
                            <th className="px-3 py-2 text-right text-xs text-muted-foreground font-medium w-36">
                              Qty <span className="text-muted-foreground/60">(Balance)</span>
                            </th>
                            <th className="w-10" />
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {fields.map((field, index) => {
                            const orderId  = watchedLines[index]?.orderId ?? ''
                            const order    = orderMap.get(orderId)
                            const balance  = balanceMap.get(orderId) ?? 0
                            const enteredQty = watchedLines[index]?.quantity ?? 0
                            const overBalance = orderId && enteredQty > balance

                            return (
                              <tr key={field.id} className="align-top">
                                <td className="px-3 py-3 text-muted-foreground text-xs">{index + 1}</td>
                                <td className="px-3 py-2 min-w-[200px]">
                                  <Controller
                                    control={form.control}
                                    name={`lines.${index}.orderId`}
                                    render={({ field: f, fieldState }) => (
                                      <div>
                                        <ItemPickerDialog
                                          items={pickerItems}
                                          value={f.value}
                                          onSelect={(id) => {
                                            f.onChange(id)
                                            /* Auto-fill quantity with full balance */
                                            const bal = balanceMap.get(id) ?? 0
                                            form.setValue(`lines.${index}.quantity`, bal)
                                          }}
                                          placeholder={pickerPlaceholder}
                                          title={pickerTitle}
                                        />
                                        {fieldState.error && (
                                          <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>
                                        )}
                                        {order && (
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            {order.partyName} · {order.date}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  />
                                </td>
                                <td className="px-3 py-2 w-36">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={balance || undefined}
                                    step="0.001"
                                    placeholder="0"
                                    className={`text-right ${overBalance ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                                    {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
                                  />
                                  {orderId && (
                                    <p className={`text-xs mt-0.5 text-right ${overBalance ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                      {overBalance
                                        ? `Max: ${balance.toLocaleString(undefined, { maximumFractionDigits: 3 })}`
                                        : `Bal: ${balance.toLocaleString(undefined, { maximumFractionDigits: 3 })}`
                                      }
                                    </p>
                                  )}
                                  {form.formState.errors.lines?.[index]?.quantity && (
                                    <p className="text-xs text-destructive mt-0.5">
                                      {form.formState.errors.lines[index]?.quantity?.message}
                                    </p>
                                  )}
                                </td>
                                <td className="px-1 py-2 pt-2">
                                  <Button
                                    type="button" variant="ghost" size="icon-sm"
                                    onClick={() => remove(index)} disabled={fields.length === 1}
                                    className="text-muted-foreground hover:text-destructive">
                                    <Trash2 className="size-4" />
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="px-3 pt-3">
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => append({ orderId: '', quantity: 0 })}
                        className="gap-1.5">
                        <Plus className="size-4" /> Add Order
                      </Button>
                    </div>
                  </>
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
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                    }`}>
                      {watchType === 'purchase' ? 'Inward' : 'Outward'}
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

                <div className="space-y-1.5 mb-5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Orders</span>
                    <span className="font-bold tabular-nums">{fields.length}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-muted-foreground">Total Qty</span>
                    <span className="text-xl font-extrabold tabular-nums tracking-tight">
                      {totalQty > 0 ? totalQty.toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    type="submit"
                    className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
                    disabled={isPending || ordersEmpty}>
                    {isPending ? 'Saving…' : 'Issue Gatepass'}
                  </Button>
                  <ExitButton
                    isDirty={form.formState.isDirty}
                    onExit={() => router.back()}
                    className="w-full min-h-[44px]"
                  />
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
