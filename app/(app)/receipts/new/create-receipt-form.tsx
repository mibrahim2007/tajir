'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FormProvider, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { receiptTenderLineFormSchema } from '@/lib/constants/tender-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ItemPickerDialog, type PickerItem } from '@/components/item-picker-dialog'
import { QuickCreateCustomer } from '@/components/quick-create-forms'
import { TenderLinesField, type ReceiptTenderLine, type OnlineAccount } from '@/components/tender-lines-field'
import { PartyTransactionHistory, type TxnHistoryItem } from '@/components/party-transaction-history'
import { createArReceiptAction } from '@/app/actions/create-ar-receipt'
import { editArReceiptAction } from '@/app/actions/edit-ar-receipt'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'
import { FileUploader, type FileUploaderHandle } from '@/components/file-uploader'
import { formatPKR } from '@/lib/utils/currency'
import { todayPKT } from '@/lib/utils/dates'
import { Checkbox } from '@/components/ui/checkbox'
import { InvoiceAllocations, appliedTotal, type OpenInvoice } from './invoice-allocations'

type Customer = { id: string; name: string; outstanding: number }
type Bank      = { id: string; name: string; account_number: string | null }
type Supplier  = { id: string; name: string }

type Props = {
  today:           string
  customers:       Customer[]
  /** Open sale invoices per customer, oldest first — for "receive against invoice". */
  openInvoicesByCustomer: Record<string, OpenInvoice[]>
  banks:           Bank[]
  /** For Direct Payment lines: suppliers the customer may have paid for us. */
  suppliers:       Supplier[]
  /** For Online lines: GL accounts the money may land in (blank = Cash at Bank). */
  onlineAccounts?: OnlineAccount[]
  nextSerial?:     string | null
  historyByCustomer?: Record<string, TxnHistoryItem[]>
  mode?:           'create' | 'edit'
  receiptId?:      string
  initial?: {
    customerId:        string
    currencyCode:      'PKR' | 'USD'
    exchangeRate:      number
    date:              string
    paymentMethodNote: string
    lines:             ReceiptTenderLine[]
    /** invoice key → PKR already applied by this receipt. */
    allocations?:      Record<string, number>
  }
}


const schema = z.object({
  customerId:        z.string().uuid('Select a customer'),
  currencyCode:      z.enum(['PKR', 'USD']).default('PKR'),
  exchangeRate:      z.number().positive().default(1),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  paymentMethodNote: z.string().optional(),
  lines:             z.array(receiptTenderLineFormSchema).min(1, 'Add at least one tender line'),
}).refine((v) => v.lines.some((l) => (Number(l.amount) || 0) > 0), {
  message: 'Enter a positive amount for at least one tender line',
  path: ['lines'],
})

type FormValues = z.infer<typeof schema>

const emptyLine: ReceiptTenderLine = { transactionType: 'cash', chequeNumber: '', chequeDueDate: '', bankId: '', amount: 0, supplierId: '', hawalaRemarks: '', accountId: '', chequeBankName: '' }

export function ReceiptForm({ today, customers, openInvoicesByCustomer, banks, suppliers, onlineAccounts = [], nextSerial, historyByCustomer, mode = 'create', receiptId, initial }: Props) {
  const router = useRouter()
  const isEdit = mode === 'edit'
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const uploaderRef = useRef<FileUploaderHandle>(null)
  const handleEnterToNext = useEnterToNextField()
  const [allocations, setAllocations] = useState<Record<string, number>>(initial?.allocations ?? {})
  const [againstInvoice, setAgainstInvoice] = useState(Object.keys(initial?.allocations ?? {}).length > 0)

  const [customerFull, setCustomerFull] = useState<Customer[]>(customers)
  const customerPickerItems: PickerItem[] = customerFull.map((c) => ({
    id: c.id, name: c.name,
    meta: c.outstanding > 0 ? `${formatPKR(c.outstanding)} outstanding` : undefined,
  }))

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: initial ?? {
      customerId: '', currencyCode: 'PKR', exchangeRate: 1, date: today, paymentMethodNote: '', lines: [{ ...emptyLine }],
    },
  })

  const selectedCustomerId = form.watch('customerId')
  const watchedCurrency     = form.watch('currencyCode')
  const watchedExchangeRate = form.watch('exchangeRate')
  const watchedLines        = form.watch('lines')

  const selectedCustomer = customerFull.find((c) => c.id === selectedCustomerId)
  const openInvoices     = selectedCustomerId ? (openInvoicesByCustomer[selectedCustomerId] ?? []) : []
  const customerHistory  = selectedCustomerId ? (historyByCustomer?.[selectedCustomerId] ?? []) : []
  const er               = watchedCurrency === 'USD' ? (watchedExchangeRate || 1) : 1
  const amountTotal      = (watchedLines ?? []).reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const amountPkr        = amountTotal * er
  const applied          = againstInvoice ? appliedTotal(allocations) : 0
  const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 })

  const onSubmit = (values: FormValues) => {
    const allocationList = againstInvoice
      ? Object.entries(allocations).filter(([, n]) => n > 0).map(([invoiceKey, amount]) => ({ invoiceKey, amount }))
      : []
    if (allocationList.reduce((s, a) => s + a.amount, 0) > amountPkr + 0.01) {
      setServerError('Applied to invoices is more than the receipt amount.')
      return
    }
    const overBalance = allocationList.find((a) => a.amount > (openInvoices.find((i) => i.key === a.invoiceKey)?.balance ?? 0) + 0.01)
    if (overBalance) {
      setServerError(`Invoice ${openInvoices.find((i) => i.key === overBalance.invoiceKey)?.serial ?? ''} is applied more than its balance.`)
      return
    }
    startTransition(async () => {
      setServerError(null)
      const payload = {
        allocations: allocationList,
        currencyCode: values.currencyCode,
        exchangeRate: values.exchangeRate,
        date: values.date,
        paymentMethodNote: values.paymentMethodNote,
        lines: values.lines.filter((l) => (Number(l.amount) || 0) > 0).map((l) => ({
          transactionType: l.transactionType,
          chequeNumber: l.chequeNumber || undefined,
          chequeDueDate: l.chequeDueDate || undefined,
          bankId: l.bankId || undefined,
          supplierId: l.transactionType === 'direct' ? (l.supplierId || undefined) : undefined,
          hawalaRemarks: l.transactionType === 'direct' ? (l.hawalaRemarks || undefined) : undefined,
          accountId: l.transactionType === 'online' ? (l.accountId || undefined) : undefined,
          chequeBankName: l.transactionType === 'pdc' ? (l.chequeBankName || undefined) : undefined,
          amount: l.amount,
        })),
      }
      const result = isEdit && receiptId
        ? await editArReceiptAction({ id: receiptId, ...payload })
        : await createArReceiptAction({ customerId: values.customerId, ...payload })
      if (!result.success) { setServerError(result.error); return }
      if (!isEdit && 'data' in result && result.data) {
        await uploaderRef.current?.uploadFiles(result.data.id, 'ar_receipt')
      }
      // Navigate to the list. Do NOT call router.refresh() after push — inside a
      // transition that keeps isPending true forever, hanging the Save button.
      router.push('/receipts')
    })
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, () => setServerError('Please complete the highlighted fields and enter a positive amount.'))} onKeyDown={handleEnterToNext}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base">Receipt Details</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">

                {/* Serial · Customer · Date · Currency share one row on wide screens. */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  {nextSerial && !isEdit && (
                    <div className="space-y-1 md:col-span-3">
                      <Label>Serial No.</Label>
                      <Input value={nextSerial} disabled readOnly className="min-h-[44px] font-mono" />
                      <p className="text-xs text-muted-foreground">Auto-generated on save.</p>
                    </div>
                  )}

                  {/* Customer */}
                  <div className={`space-y-1 ${nextSerial && !isEdit ? 'md:col-span-5' : 'md:col-span-8'}`}>
                    <Label>Customer <span className="text-destructive">*</span></Label>
                    {isEdit ? (
                      <Input value={selectedCustomer?.name ?? '—'} disabled readOnly className="min-h-[44px]" />
                    ) : (
                      <Controller
                        control={form.control}
                        name="customerId"
                        render={({ field, fieldState }) => (
                          <>
                            <ItemPickerDialog
                              items={customerPickerItems}
                              value={field.value}
                              onSelect={(id) => { field.onChange(id); setAllocations({}) }}
                              placeholder="Select customer…"
                              title="Select Customer"
                              createLabel="New Customer"
                              onCreateSuccess={(item) => setCustomerFull((prev) => [...prev, { id: item.id, name: item.name, outstanding: 0 }])}
                              quickCreate={(onSuccess, onCancel) => (
                                <QuickCreateCustomer onSuccess={onSuccess} onCancel={onCancel} />
                              )}
                            />
                            {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
                          </>
                        )}
                      />
                    )}
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label>Date <span className="text-destructive">*</span></Label>
                    <Input type="date" max={todayPKT()} {...form.register('date')} className="min-h-[44px]" />
                    {form.formState.errors.date && <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>}
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Currency</Label>
                    <Controller
                      control={form.control}
                      name="currencyCode"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PKR">PKR</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {/* Outstanding reference */}
                {selectedCustomer && !isEdit && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Outstanding balance</span>
                      <span className={`font-semibold tabular-nums ${selectedCustomer.outstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {formatPKR(selectedCustomer.outstanding)}
                      </span>
                    </div>
                  </div>
                )}

                {watchedCurrency === 'USD' && (
                  <div className="space-y-1 md:max-w-xs">
                    <Label>Exchange Rate (PKR per USD) <span className="text-destructive">*</span></Label>
                    <Input type="number" step="0.01" min="1" {...form.register('exchangeRate', { valueAsNumber: true })} className="min-h-[44px]" />
                  </div>
                )}

                <Separator />

                <TenderLinesField banks={banks} currency={watchedCurrency} suppliers={suppliers} onlineAccounts={onlineAccounts} pdcBankText layout="wide" />
                {watchedCurrency !== 'PKR' && (watchedLines ?? []).some((l) => l.transactionType === 'direct') && (
                  <p className="text-xs text-destructive">A direct payment to a supplier must be in PKR.</p>
                )}

                <div className="space-y-1">
                  <Label>Note</Label>
                  <Input placeholder="e.g. Advance against invoice…" {...form.register('paymentMethodNote')} className="min-h-[44px]" />
                </div>
              </CardContent>
            </Card>

            {selectedCustomer && (
              <Card>
                <CardHeader className="pb-3 pt-5 px-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={againstInvoice}
                      onCheckedChange={(on) => setAgainstInvoice(on === true)}
                      className="mt-0.5"
                    />
                    <span>
                      <CardTitle className="text-base">Receive against sale invoice <span className="font-normal text-muted-foreground">(optional)</span></CardTitle>
                      <span className="block text-xs text-muted-foreground mt-1">
                        Apply this receipt to specific invoices. Leave off to settle the oldest invoices first.
                      </span>
                    </span>
                  </label>
                </CardHeader>
                {againstInvoice && (
                  <CardContent className="px-5 pb-5">
                    <InvoiceAllocations invoices={openInvoices} value={allocations} onChange={setAllocations} receiptPkr={amountPkr} />
                  </CardContent>
                )}
              </Card>
            )}
          </div>

          {/* ── RIGHT COLUMN — transaction history + sticky summary ── */}
          <div className="xl:sticky xl:top-6 space-y-4">
            {selectedCustomer && !isEdit && (
              <PartyTransactionHistory items={customerHistory} />
            )}
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Receipt Summary</p>

                <div className="space-y-2 text-sm">
                  {selectedCustomer ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Customer</span>
                        <span className="font-medium text-right max-w-[140px] truncate">{selectedCustomer.name}</span>
                      </div>
                      {!isEdit && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Outstanding</span>
                          <span className={`tabular-nums font-medium ${selectedCustomer.outstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            Rs {fmt(selectedCustomer.outstanding)}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Select a customer to see balance.</p>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="flex justify-between items-center mb-5">
                  <span className="font-bold text-sm">Receiving</span>
                  <span className="text-xl font-extrabold tabular-nums tracking-tight">
                    Rs {fmt(amountPkr)}
                  </span>
                </div>

                {applied > 0 && (
                  <div className="space-y-1 text-sm -mt-2 mb-5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Against invoices</span>
                      <span className="tabular-nums font-medium">Rs {fmt(applied)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">On account</span>
                      <span className={`tabular-nums font-medium ${amountPkr - applied < -0.01 ? 'text-destructive' : ''}`}>Rs {fmt(amountPkr - applied)}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 text-white" disabled={isPending}>
                    {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Record Receipt'}
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
export const CreateReceiptForm = ReceiptForm
