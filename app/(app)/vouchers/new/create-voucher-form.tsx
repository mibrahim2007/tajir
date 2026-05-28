'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createJournalEntryAction } from '@/app/actions/create-journal-entry'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

const lineSchema = z.object({
  accountId:   z.string().min(1, 'Account required'),
  description: z.string().optional(),
  debit:       z.number().min(0),
  credit:      z.number().min(0),
})

const schema = z.object({
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  description: z.string().min(1, 'Narration is required'),
  reference:   z.string().optional(),
  lines:       z.array(lineSchema).min(2),
})

type FormValues = z.infer<typeof schema>

type Account = { id: string; code: string; name: string; account_type: string }

type Props = {
  today: string
  accounts: Account[]
  customers: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  lots: { id: string; name: string }[]
}

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense']

export function CreateVoucherForm({ today, accounts }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()

  // Group accounts by type for the select
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    items: accounts.filter((a) => a.account_type === type),
  })).filter((g) => g.items.length > 0)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      date: today,
      description: '',
      reference: '',
      lines: [
        { accountId: '', description: '', debit: 0, credit: 0 },
        { accountId: '', description: '', debit: 0, credit: 0 },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const lines = form.watch('lines')

  const totalDebit  = lines.reduce((s, l) => s + (l.debit  || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0)
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createJournalEntryAction({
        ...values,
        reference: values.reference || undefined,
        lines: values.lines.map((l) => ({
          ...l,
          description: l.description || undefined,
        })),
      })
      if (!result.success) { setServerError(result.error); return }
      router.push(`/vouchers/${result.data.id}`)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-6">

        {/* Header */}
        <Card>
          <CardContent className="pt-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="date" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="reference" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference</FormLabel>
                  <FormControl><Input placeholder="Cheque no., bill no.…" className="min-h-[44px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Narration <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Being…" className="min-h-[44px]" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Lines */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Journal Lines</h2>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => append({ accountId: '', description: '', debit: 0, credit: 0 })}
            >
              Add Line
            </Button>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Account</th>
                  <th className="text-left px-3 py-2 font-medium">Description</th>
                  <th className="text-right px-3 py-2 font-medium w-32">Debit</th>
                  <th className="text-right px-3 py-2 font-medium w-32">Credit</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {fields.map((field, index) => (
                  <tr key={field.id}>
                    <td className="px-2 py-1.5">
                      <FormField control={form.control} name={`lines.${index}.accountId`} render={({ field: f }) => (
                        <Select onValueChange={f.onChange} value={f.value}>
                          <SelectTrigger className="min-h-[40px] text-xs">
                            <SelectValue placeholder="Select account…" />
                          </SelectTrigger>
                          <SelectContent>
                            {grouped.map((g) => (
                              <div key={g.type}>
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
                      )} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        placeholder="Details…"
                        className="min-h-[40px] text-xs"
                        {...form.register(`lines.${index}.description`)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number" step="0.01" min="0" className="min-h-[40px] text-right tabular-nums text-xs"
                        {...form.register(`lines.${index}.debit`, { valueAsNumber: true })}
                        onChange={(e) => {
                          form.setValue(`lines.${index}.debit`, parseFloat(e.target.value) || 0)
                          if (parseFloat(e.target.value) > 0) form.setValue(`lines.${index}.credit`, 0)
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number" step="0.01" min="0" className="min-h-[40px] text-right tabular-nums text-xs"
                        {...form.register(`lines.${index}.credit`, { valueAsNumber: true })}
                        onChange={(e) => {
                          form.setValue(`lines.${index}.credit`, parseFloat(e.target.value) || 0)
                          if (parseFloat(e.target.value) > 0) form.setValue(`lines.${index}.debit`, 0)
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {fields.length > 2 && (
                        <button type="button" onClick={() => remove(index)} className="text-muted-foreground hover:text-destructive text-lg leading-none px-1">
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td className="px-3 py-2 font-semibold text-xs" colSpan={2}>Total</td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums text-xs ${!isBalanced && totalDebit > 0 ? 'text-destructive' : ''}`}>
                    {totalDebit.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums text-xs ${!isBalanced && totalCredit > 0 ? 'text-destructive' : ''}`}>
                    {totalCredit.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {totalDebit > 0 && !isBalanced && (
            <p className="text-xs text-destructive mt-2">
              Difference: {Math.abs(totalDebit - totalCredit).toFixed(2)} — debits must equal credits.
            </p>
          )}
        </div>

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 min-h-[44px]" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1 min-h-[44px]" disabled={isPending || !isBalanced}>
            {isPending ? 'Posting…' : 'Post Voucher'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
