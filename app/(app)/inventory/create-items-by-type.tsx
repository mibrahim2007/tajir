'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft,
  Check,
  FlaskConical,
  Layers,
  Package,
  Palette,
  Pill,
  Plus,
  Scissors,
  Shirt,
  ShoppingBasket,
  Trash2,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ITEM_TYPE_PRESETS, unitsForType } from './item-type-presets'
import { ensureItemTypeAction } from '@/app/actions/ensure-item-type'
import { createInventoryLotsBatchAction } from '@/app/actions/create-inventory-lots-batch'

const ICONS: Record<string, LucideIcon> = {
  Layers,
  Scissors,
  Shirt,
  Zap,
  Wrench,
  Pill,
  ShoppingBasket,
  Palette,
  FlaskConical,
}

const itemsSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1, 'Required'),
        count: z.string().optional(),
        unitOfMeasure: z.string().optional(),
        code: z.string().optional(),
      }),
    )
    .min(1),
})
type ItemsForm = z.infer<typeof itemsSchema>

type ItemType = { id: string; name: string }
type SelectedType = { id: string; name: string; units: string[] }

// Full-page form at /inventory/new-by-type (was a drawer on the inventory list).
export function CreateItemsByType({ itemTypes }: { itemTypes: ItemType[] }) {
  const router = useRouter()
  const [step, setStep] = useState<'type' | 'items'>('type')
  const [selected, setSelected] = useState<SelectedType | null>(null)
  const [customName, setCustomName] = useState('')
  const [typeError, setTypeError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isEnsuring, startEnsure] = useTransition()
  const [isSaving, startSave] = useTransition()

  const form = useForm<ItemsForm>({
    resolver: zodResolver(itemsSchema),
    defaultValues: { items: [{ name: '', count: '', unitOfMeasure: '', code: '' }] },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const namedCount = form.watch('items').filter((i) => i.name?.trim()).length

  // Existing custom types that aren't already covered by a preset chip.
  const presetNames = useMemo(
    () => new Set(ITEM_TYPE_PRESETS.map((p) => p.name.toLowerCase())),
    [],
  )
  const customTypes = useMemo(
    () => itemTypes.filter((t) => !presetNames.has(t.name.toLowerCase())),
    [itemTypes, presetNames],
  )

  const chooseType = (name: string) => {
    const clean = name.trim()
    if (!clean) return
    setTypeError(null)
    startEnsure(async () => {
      const result = await ensureItemTypeAction({ name: clean })
      if (!result.success) {
        setTypeError(result.error)
        return
      }
      const units = unitsForType(result.data.name)
      setSelected({ id: result.data.id, name: result.data.name, units })
      form.reset({ items: [{ name: '', count: '', unitOfMeasure: units[0] ?? '', code: '' }] })
      setStep('items')
    })
  }

  const onSubmit = (values: ItemsForm) => {
    if (!selected) return
    setServerError(null)
    startSave(async () => {
      const result = await createInventoryLotsBatchAction({
        itemTypeId: selected.id,
        items: values.items,
      })
      if (!result.success) {
        setServerError(result.error)
        return
      }
      // Back to the list, which re-renders with the new items. No
      // router.refresh() inside the transition — it keeps isPending stuck.
      router.push('/inventory')
    })
  }

  if (step === 'type') {
    return (
      <Card className="min-w-0">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="text-base">What type of items do you want to create?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pick a category to file this batch of items under. New categories are added automatically.
          </p>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ITEM_TYPE_PRESETS.map((preset) => {
              const Icon = ICONS[preset.icon] ?? Package
              return (
                <button
                  key={preset.name}
                  type="button"
                  disabled={isEnsuring}
                  onClick={() => chooseType(preset.name)}
                  className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-50 min-h-[92px]"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold leading-tight">{preset.name}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">{preset.description}</span>
                </button>
              )
            })}
          </div>

          {customTypes.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your item types
              </p>
              <div className="flex flex-wrap gap-2">
                {customTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={isEnsuring}
                    onClick={() => chooseType(t.name)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary hover:bg-accent disabled:opacity-50 min-h-[36px]"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 max-w-xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Other / custom category
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Hardware, Cosmetics…"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    chooseType(customName)
                  }
                }}
                className="min-h-[44px]"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={isEnsuring || !customName.trim()}
                onClick={() => chooseType(customName)}
                className="min-h-[44px]"
              >
                Use
              </Button>
            </div>
          </div>

          {typeError && <p className="mt-4 text-sm text-destructive">{typeError}</p>}
          {isEnsuring && <p className="mt-4 text-sm text-muted-foreground">Preparing…</p>}

          <Separator className="my-5" />
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => router.push('/inventory')}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">

          {/* ── FORM (left on xl) ── */}
          <Card className="min-w-0">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base">New {selected?.name} Items</CardTitle>
              <p className="text-sm text-muted-foreground">
                {`Add one or more ${selected?.name?.toLowerCase() ?? ''} items.`} They&rsquo;ll all be filed under this type.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep('type')
                  setServerError(null)
                }}
                className="self-start inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Change type
              </button>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex flex-col gap-3">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Item {index + 1}</span>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    <FormField
                      control={form.control}
                      name={`items.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-5">
                          <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Super Fine 30s Combed" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.count`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Count</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="decimal"
                              placeholder="e.g. 10"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.unitOfMeasure`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Unit</FormLabel>
                          <Select
                            value={field.value || '_none_'}
                            onValueChange={(v) => field.onChange(v === '_none_' ? '' : v)}
                          >
                            <FormControl>
                              <SelectTrigger className="min-h-[44px] w-full">
                                <SelectValue placeholder="Unit…" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="_none_">No unit</SelectItem>
                              {(selected?.units ?? []).map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.code`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-3">
                          <FormLabel>Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Optional short code" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] self-start"
                onClick={() =>
                  append({ name: '', count: '', unitOfMeasure: selected?.units[0] ?? '', code: '' })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add another item
              </Button>
            </CardContent>
          </Card>

          {/* ── SUMMARY (right on xl, sticky) ── */}
          <div className="xl:sticky xl:top-6">
            <Card>
              <CardContent className="px-5 pt-5 pb-5">
                <p className="font-extrabold text-[15px] tracking-tight mb-4">Batch Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium text-right truncate">{selected?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items</span>
                    <span className="tabular-nums">{fields.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Named</span>
                    <span className="tabular-nums">{namedCount}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isSaving}>
                    {isSaving ? (
                      'Creating…'
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Create {fields.length} {fields.length === 1 ? 'item' : 'items'}
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => router.push('/inventory')}>
                    Cancel
                  </Button>
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
