'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExitButton } from '@/components/exit-button'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createExpenseAction } from '@/app/actions/create-expense'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'
import { FileUploader, type FileUploaderHandle } from '@/components/file-uploader'

type Account = { id: string; code: string; name: string; account_type: string }
type Bank    = { id: string; name: string; account_number: string | null }

type Props = {
  today:    string
  accounts: Account[]
  banks:    Bank[]
}

const CODE_GROUP_LABELS: Record<string, string> = {
  '5': 'Cost of Sales',
  '6': 'Operating Expenses',
  '7': 'Financial Charges',
}

const schema = z.object({
  expenseAccountId: z.string().uuid('Select an expense account'),
  amount:           z.coerce.number().positive('Amount must be positive'),
  date:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  description:      z.string().min(1, 'Description is required'),
  note:             z.string().optional(),
  bankId:           z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function CreateExpenseForm({ today, accounts, banks }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const uploaderRef = useRef<FileUploaderHandle>(null)
  const handleEnterToNext = useEnterToNextField()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { expenseAccountId: '', amount: 0, date: today, description: '', note: '', bankId: '' },
  })

  const grouped = ['5', '6', '7'].map((prefix) => ({
    label: CODE_GROUP_LABELS[prefix],
    items: accounts.filter((a) => a.code.startsWith(prefix)),
  })).filter((g) => g.items.length > 0)

  const watchedAccountId = form.watch('expenseAccountId')
  const watchedAmount    = form.watch('amount')
  const watchedDate      = form.watch('date')

  const selectedAccount  = accounts.find((a) => a.id === watchedAccountId)
  const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 0 })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createExpenseAction({ ...values, bankId: values.bankId || undefined })
      if (!result.success) { setServerError(result.error); return }
      await uploaderRef.current?.uploadFiles(result.data.id, 'expense')
      router.push('/expenses')
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">Expense Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">

              {/* Expense Account */}
              <div className="space-y-1">
                <Label>Expense Account <span className="text-destructive">*</span></Label>
                <Controller
                  control={form.control}
                  name="expenseAccountId"
                  render={({ field, fieldState }) => (
                    <>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder="Select account…" />
                        </SelectTrigger>
                        <SelectContent>
                          {grouped.map((g) => (
                            <div key={g.label}>
                              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{g.label}</div>
                              {g.items.map((a) => (
                                <SelectItem key={a.id} value={a.id} className="text-xs">
                                  <span className="font-mono text-muted-foreground mr-2">{a.code}</span>{a.name}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
                    </>
                  )}
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label>Description <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. Office rent, Electricity bill…" {...form.register('description')} className="min-h-[44px]" />
                {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
              </div>

              {/* Amount + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Amount (PKR) <span className="text-destructive">*</span></Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00"
                    {...form.register('amount', { valueAsNumber: true })} className="min-h-[44px]" />
                  {form.formState.errors.amount && <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Date <span className="text-destructive">*</span></Label>
                  <Input type="date" {...form.register('date')} className="min-h-[44px]" />
                  {form.formState.errors.date && <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>}
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1">
                <Label>Note (optional)</Label>
                <Input placeholder="e.g. Payee name, invoice number…" {...form.register('note')} className="min-h-[44px]" />
              </div>

              {/* Bank */}
              {banks.length > 0 && (
                <div className="space-y-1">
                  <Label>Bank (optional)</Label>
                  <Controller
                    control={form.control}
                    name="bankId"
                    render={({ field }) => (
                      <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}>
                        <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Cash / no bank" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Cash / no bank</SelectItem>
                          {banks.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}{b.account_number ? ` — ${b.account_number}` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT COLUMN — sticky summary ── */}
        <div className="lg:sticky lg:top-6">
          <Card>
            <CardContent className="px-5 pt-5 pb-5">
              <p className="font-extrabold text-[15px] tracking-tight mb-4">Expense Summary</p>

              <div className="space-y-2 text-sm">
                {selectedAccount ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Account</span>
                    <span className="font-medium text-right text-xs leading-5">{selectedAccount.name}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Select an account above.</p>
                )}
                {watchedDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium tabular-nums">{watchedDate}</span>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between items-center mb-5">
                <span className="font-bold text-sm">Amount</span>
                <span className="text-xl font-extrabold tabular-nums tracking-tight">
                  Rs {fmt(watchedAmount || 0)}
                </span>
              </div>

              <div className="space-y-2">
                <Button type="submit" className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 text-white" disabled={isPending}>
                  {isPending ? 'Saving…' : 'Record Expense'}
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
  )
}
