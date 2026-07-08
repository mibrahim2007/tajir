'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createAccountAction } from '@/app/actions/create-account'
import { ACCOUNT_TYPES } from '@/lib/accounting/account-types'

const TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  asset: 'Asset', liability: 'Liability', equity: 'Equity', revenue: 'Revenue', expense: 'Expense',
}

const schema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(10, 'Max 10 characters'),
  name: z.string().trim().min(1, 'Name is required').max(200),
  accountType: z.enum(ACCOUNT_TYPES, { message: 'Select a type' }),
  parentCode: z.string().optional(),
  isHeader: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

type Account = { code: string; name: string; account_type: string }

export function AddAccountButton({ accounts }: { accounts: Account[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', name: '', accountType: undefined, parentCode: '_none_', isHeader: false },
  })

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await createAccountAction({
        code: values.code,
        name: values.name,
        accountType: values.accountType,
        parentCode: values.parentCode && values.parentCode !== '_none_' ? values.parentCode : undefined,
        isHeader: values.isHeader,
      })
      if (!result.success) { setError(result.error); return }
      form.reset({ code: '', name: '', accountType: undefined, parentCode: '_none_', isHeader: false })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setError(null); form.reset() } }}>
      <DialogTrigger asChild>
        <Button className="min-h-[44px] gap-2">
          <Plus className="size-4" /> Add Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Account</DialogTitle>
          <DialogDescription>Add a GL account to your chart of accounts.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem className="col-span-1">
                  <FormLabel>Code <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="6300" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="e.g. Utilities Expense" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="accountType" render={({ field }) => (
              <FormItem>
                <FormLabel>Account Type <span className="text-destructive">*</span></FormLabel>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select type…" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="parentCode" render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Account</FormLabel>
                <Select
                  value={field.value || '_none_'}
                  onValueChange={(v) => {
                    field.onChange(v)
                    // Inherit the parent's type by default (still editable above).
                    const parent = accounts.find((a) => a.code === v)
                    if (parent && ACCOUNT_TYPES.includes(parent.account_type as (typeof ACCOUNT_TYPES)[number])) {
                      form.setValue('accountType', parent.account_type as (typeof ACCOUNT_TYPES)[number])
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="_none_">None (top-level)</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="isHeader" render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
                </FormControl>
                <FormLabel className="font-normal cursor-pointer">
                  Header account <span className="text-muted-foreground">(a grouping row, not posted to)</span>
                </FormLabel>
              </FormItem>
            )} />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create Account'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
