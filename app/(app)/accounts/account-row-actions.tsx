'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Ban, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { editAccountAction } from '@/app/actions/edit-account'
import { setAccountActiveAction } from '@/app/actions/set-account-active'
import { ACCOUNT_TYPES } from '@/lib/accounting/account-types'

const TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  asset: 'Asset', liability: 'Liability', equity: 'Equity', revenue: 'Revenue', expense: 'Expense',
}

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  accountType: z.enum(ACCOUNT_TYPES, { message: 'Select a type' }),
  parentCode: z.string().optional(),
  isHeader: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

export type RowAccount = {
  id: string
  code: string
  name: string
  account_type: string
  parent_code: string | null
  is_header: boolean
  is_active: boolean
}
type PickerAccount = { code: string; name: string; parent_code: string | null }

export function AccountRowActions({ account, accounts }: { account: RowAccount; accounts: PickerAccount[] }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Codes that can't be a parent: the account itself and all its descendants
  // (choosing one would create a loop).
  const invalidParents = useMemo(() => {
    const childrenOf = new Map<string, string[]>()
    for (const a of accounts) {
      if (a.parent_code) {
        const list = childrenOf.get(a.parent_code) ?? []
        list.push(a.code)
        childrenOf.set(a.parent_code, list)
      }
    }
    const blocked = new Set<string>([account.code])
    const stack = [account.code]
    while (stack.length) {
      const code = stack.pop()!
      for (const child of childrenOf.get(code) ?? []) {
        if (!blocked.has(child)) { blocked.add(child); stack.push(child) }
      }
    }
    return blocked
  }, [accounts, account.code])

  const parentOptions = accounts.filter((a) => !invalidParents.has(a.code))

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: account.name,
      accountType: account.account_type as (typeof ACCOUNT_TYPES)[number],
      parentCode: account.parent_code ?? '_none_',
      isHeader: account.is_header,
    },
  })

  const onEdit = (values: FormValues) => {
    startTransition(async () => {
      setError(null)
      const result = await editAccountAction({
        id: account.id,
        name: values.name,
        accountType: values.accountType,
        parentCode: values.parentCode && values.parentCode !== '_none_' ? values.parentCode : undefined,
        isHeader: values.isHeader,
      })
      if (!result.success) { setError(result.error); return }
      setEditOpen(false)
      router.refresh()
    })
  }

  const toggleActive = () => {
    if (account.is_active && !confirm(`Deactivate "${account.name}"? It will be hidden from new entries and reports. You can reactivate it later.`)) return
    startTransition(async () => {
      const result = await setAccountActiveAction({ id: account.id, isActive: !account.is_active })
      if (!result.success) { alert(result.error); return }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1">
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (o) { form.reset({ name: account.name, accountType: account.account_type as (typeof ACCOUNT_TYPES)[number], parentCode: account.parent_code ?? '_none_', isHeader: account.is_header }); setError(null) } }}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" title="Edit account">
            <Pencil className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Code <span className="font-mono">{account.code}</span> can&rsquo;t be changed.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEdit)} className="flex flex-col gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="accountType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Type <span className="text-destructive">*</span></FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select type…" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="parentCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Account</FormLabel>
                  <Select value={field.value || '_none_'} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none_">None (top-level)</SelectItem>
                      {parentOptions.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>)}
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
                  <FormLabel className="font-normal cursor-pointer">Header account <span className="text-muted-foreground">(grouping row)</span></FormLabel>
                </FormItem>
              )} />

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full min-h-[44px]" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={toggleActive}
        title={account.is_active ? 'Deactivate account' : 'Reactivate account'}
        className={`h-8 w-8 p-0 ${account.is_active ? 'text-muted-foreground hover:text-destructive' : 'text-emerald-600 hover:text-emerald-700'}`}
      >
        {account.is_active ? <Ban className="size-4" /> : <RotateCcw className="size-4" />}
      </Button>
    </div>
  )
}
