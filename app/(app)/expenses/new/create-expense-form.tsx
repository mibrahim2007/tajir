'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createExpenseAction } from '@/app/actions/create-expense'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'
import { FileUploader, type FileUploaderHandle } from '@/components/file-uploader'

type Account = { id: string; code: string; name: string; account_type: string }
type Bank = { id: string; name: string; account_number: string | null }

type Props = {
  today: string
  accounts: Account[]
  banks: Bank[]
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

  // Group accounts by code prefix (5xxx, 6xxx, 7xxx)
  const grouped = ['5', '6', '7'].map((prefix) => ({
    label: CODE_GROUP_LABELS[prefix],
    items: accounts.filter((a) => a.code.startsWith(prefix)),
  })).filter((g) => g.items.length > 0)

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
    <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-5">

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
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {g.label}
                      </div>
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

      {/* Amount */}
      <div className="space-y-1">
        <Label>Amount (PKR) <span className="text-destructive">*</span></Label>
        <Input
          type="number" step="0.01" min="0" placeholder="0.00"
          {...form.register('amount', { valueAsNumber: true })}
          className="min-h-[44px]"
        />
        {form.formState.errors.amount && <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>}
      </div>

      {/* Date */}
      <div className="space-y-1">
        <Label>Date <span className="text-destructive">*</span></Label>
        <Input type="date" {...form.register('date')} className="min-h-[44px]" />
        {form.formState.errors.date && <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label>Description <span className="text-destructive">*</span></Label>
        <Input placeholder="e.g. Office rent, Electricity bill…" {...form.register('description')} className="min-h-[44px]" />
        {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
      </div>

      {/* Note */}
      <div className="space-y-1">
        <Label>Note (optional)</Label>
        <Input placeholder="e.g. Payee name, invoice number…" {...form.register('note')} className="min-h-[44px]" />
      </div>

      {banks.length > 0 && (
        <div className="space-y-1">
          <Label>Bank (optional)</Label>
          <Controller
            control={form.control}
            name="bankId"
            render={({ field }) => (
              <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Cash / no bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Cash / no bank</SelectItem>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}{b.account_number ? ` — ${b.account_number}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      <FileUploader ref={uploaderRef} />

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
        {isPending ? 'Saving…' : 'Record Expense'}
      </Button>
    </form>
  )
}
