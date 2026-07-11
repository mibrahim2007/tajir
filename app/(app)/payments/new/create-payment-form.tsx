'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FormProvider, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ItemPickerDialog, type PickerItem } from '@/components/item-picker-dialog'
import { QuickCreateSupplier } from '@/components/quick-create-forms'
import { TenderLinesField, type TenderLine } from '@/components/tender-lines-field'
import { createApPaymentAction } from '@/app/actions/create-ap-payment'
import { editApPaymentAction } from '@/app/actions/edit-ap-payment'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'
import { FileUploader, type FileUploaderHandle } from '@/components/file-uploader'
import { formatPKR } from '@/lib/utils/currency'
import { formatPKTDate } from '@/lib/utils/dates'

type Supplier = { id: string; name: string; outstanding: number }
type Purchase = { id: string; date: string; itemName: string; qty: number; pkrEquivalent: number; advancePaid: number }
type Bank     = { id: string; name: string; account_number: string | null }

type Props = {
  today:               string
  suppliers:           Supplier[]
  purchasesBySupplier: Record<string, Purchase[]>
  banks:               Bank[]
  nextSerial?:         string | null
  mode?:               'create' | 'edit'
  paymentId?:          string
  initial?: {
    supplierId:        string
    currencyCode:      'PKR' | 'USD'
    exchangeRate:      number
    date:              string
    paymentMethodNote: string
    lines:             TenderLine[]
  }
}

const lineSchema = z.object({
  transactionType: z.enum(['cash', 'pdc', 'online']),
  chequeNumber:    z.string().optional().default(''),
  bankId:          z.string().optional().default(''),
  amount:          z.coerce.number().positive('Amount must be positive'),
})

const schema = z.object({
  supplierId:        z.string().uuid('Select a supplier'),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.number().positive().default(1),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote: z.string().optional(),
  lines:             z.array(lineSchema).min(1, 'Add at least one tender line'),
})

type FormValues = z.infer<typeof schema>

const emptyLine: TenderLine = { transactionType: 'cash', chequeNumber: '', bankId: '', amount: 0 }

export function PaymentForm({ today, suppliers, purchasesBySupplier, banks, nextSerial, mode = 'create', paymentId, initial }: Props) {
  const router = useRouter()
  const isEdit = mode === 'edit'
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const uploaderRef = useRef<FileUploaderHandle>(null)
  const handleEnterToNext = useEnterToNextField()

  const [supplierFull, setSupplierFull] = useState<Supplier[]>(suppliers)
  const supplierPickerItems: PickerItem[] = supplierFull.map((s) => ({
    id: s.id, name: s.name,
    meta: s.outstanding > 0 ? `${formatPKR(s.outstanding)} outstanding` : undefined,
  }))

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: initial ?? {
      supplierId: '', currencyCode: 'PKR', exchangeRate: 1, date: today, paymentMethodNote: '', lines: [{ ...emptyLine }],
    },
  })

  const selectedSupplierId  = form.watch('supplierId')
  const watchedCurrency     = form.watch('currencyCode')
  const watchedExchangeRate = form.watch('exchangeRate')
  const watchedLines        = form.watch('lines')

  const selectedSupplier  = supplierFull.find((s) => s.id === selectedSupplierId)
  const supplierPurchases = selectedSupplierId ? (purchasesBySupplier[selectedSupplierId] ?? []) : []
  const er                = watchedCurrency === 'USD' ? (watchedExchangeRate || 1) : 1
  const amountTotal       = (watchedLines ?? []).reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const amountPkr         = amountTotal * er
  const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const payload = {
        currencyCode: values.currencyCode,
        exchangeRate: values.exchangeRate,
        date: values.date,
        paymentMethodNote: values.paymentMethodNote,
        lines: values.lines.map((l) => ({
          transactionType: l.transactionType,
          chequeNumber: l.chequeNumber || undefined,
          bankId: l.bankId || undefined,
          amount: l.amount,
        })),
      }
      const result = isEdit && paymentId
        ? await editApPaymentAction({ id: paymentId, ...payload })
        : await createApPaymentAction({ supplierId: values.supplierId, ...payload })
      if (!result.success) { setServerError(result.error); return }
      if (!isEdit && 'data' in result && result.data) {
        await uploaderRef.current?.uploadFiles(result.data.id, 'ap_payment')
      }
      router.push('/payments')
      router.refresh()
    })
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base">Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">

                {nextSerial && !isEdit && (
                  <div className="space-y-1">
                    <Label>Serial No.</Label>
                    <Input value={nextSerial} disabled readOnly className="min-h-[44px] font-mono" />
                    <p className="text-xs text-muted-foreground">Auto-generated on save.</p>
                  </div>
                )}

                {/* Supplier */}
                <div className="space-y-1">
                  <Label>Supplier <span className="text-destructive">*</span></Label>
                  {isEdit ? (
                    <Input value={selectedSupplier?.name ?? '—'} disabled readOnly className="min-h-[44px]" />
                  ) : (
                    <Controller
                      control={form.control}
                      name="supplierId"
                      render={({ field, fieldState }) => (
                        <>
                          <ItemPickerDialog
                            items={supplierPickerItems}
                            value={field.value}
                            onSelect={field.onChange}
                            placeholder="Select supplier…"
                            title="Select Supplier"
                            createLabel="New Supplier"
                            onCreateSuccess={(item) => setSupplierFull((prev) => [...prev, { id: item.id, name: item.name, outstanding: 0 }])}
                            quickCreate={(onSuccess, onCancel) => (
                              <QuickCreateSupplier onSuccess={onSuccess} onCancel={onCancel} />
                            )}
                          />
                          {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
                        </>
                      )}
                    />
                  )}
                </div>

                {/* Outstanding reference */}
                {selectedSupplier && !isEdit && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Outstanding balance</span>
                      <span className={`font-semibold tabular-nums ${selectedSupplier.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatPKR(selectedSupplier.outstanding)}
                      </span>
                    </div>
                    {supplierPurchases.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground">Invoices for reference:</p>
                        <div className="space-y-1">
                          {supplierPurchases.map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{formatPKTDate(p.date + 'T00:00:00')} · {p.itemName} × {p.qty}</span>
                              <span className="tabular-nums">
                                {formatPKR(p.pkrEquivalent - p.advancePaid)}
                                {p.advancePaid > 0 && <span className="ml-1 text-green-600">(adv. {formatPKR(p.advancePaid)})</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Date <span className="text-destructive">*</span></Label>
                    <Input type="date" {...form.register('date')} className="min-h-[44px]" />
                    {form.formState.errors.date && <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Currency</Label>
                    <Controller
                      control={form.control}
                      name="currencyCode"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PKR">PKR</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {watchedCurrency === 'USD' && (
                  <div className="space-y-1">
                    <Label>Exchange Rate (PKR per USD) <span className="text-destructive">*</span></Label>
                    <Input type="number" step="0.01" min="1" {...form.register('exchangeRate', { valueAsNumber: true })} className="min-h-[44px]" />
                  </div>
                )}

                <Separator />

                <TenderLinesField banks={banks} currency={watchedCurrency} />

                <div className="space-y-1">
                  <Label>Note</Label>
                  <Input placeholder="e.g. Advance against invoice…" {...form.register('paymentMethodNote')} className="min-h-[44px]" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT COLUMN — sticky summary ── */}
          <div className="lg:sticky lg:top-6">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Payment Summary</p>

                <div className="space-y-2 text-sm">
                  {selectedSupplier ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Supplier</span>
                        <span className="font-medium text-right max-w-[140px] truncate">{selectedSupplier.name}</span>
                      </div>
                      {!isEdit && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Outstanding</span>
                          <span className={`tabular-nums font-medium ${selectedSupplier.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            Rs {fmt(selectedSupplier.outstanding)}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Select a supplier to see balance.</p>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center mb-5">
                  <span className="font-bold text-sm">Paying</span>
                  <span className="text-xl font-extrabold tabular-nums tracking-tight">
                    Rs {fmt(amountPkr)}
                  </span>
                </div>

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 text-white" disabled={isPending}>
                    {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Record Payment'}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.back()}>
                    Cancel
                  </Button>
                </div>

                {serverError && <p className="text-sm text-destructive mt-3">{serverError}</p>}

                {!isEdit && (
                  <div className="mt-4 pt-4 border-t">
                    <FileUploader ref={uploaderRef} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </form>
    </FormProvider>
  )
}

// Backwards-compatible alias for the create page.
export const CreatePaymentForm = PaymentForm
