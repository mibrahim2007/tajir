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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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

export function CreateItemsByType({ itemTypes }: { itemTypes: ItemType[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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

  // Existing custom types that aren't already covered by a preset chip.
  const presetNames = useMemo(
    () => new Set(ITEM_TYPE_PRESETS.map((p) => p.name.toLowerCase())),
    [],
  )
  const customTypes = useMemo(
    () => itemTypes.filter((t) => !presetNames.has(t.name.toLowerCase())),
    [itemTypes, presetNames],
  )

  const resetAll = () => {
    setStep('type')
    setSelected(null)
    setCustomName('')
    setTypeError(null)
    setServerError(null)
    form.reset({ items: [{ name: '', count: '', unitOfMeasure: '', code: '' }] })
  }

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
      setOpen(false)
      resetAll()
      router.refresh()
    })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) resetAll()
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-[44px]">
          <Package className="h-4 w-4 mr-2" />
          Create Items by Type
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {step === 'type' ? (
          <>
            <SheetHeader>
              <SheetTitle>What type of items do you want to create?</SheetTitle>
              <SheetDescription>
                Pick a category to file this batch of items under. New categories are added automatically.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
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

            <div className="mt-6">
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
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>New {selected?.name} items</SheetTitle>
              <SheetDescription>
                {`Add one or more ${selected?.name?.toLowerCase() ?? ''} items.`} They&rsquo;ll all be filed under this type.
              </SheetDescription>
            </SheetHeader>

            <button
              type="button"
              onClick={() => {
                setStep('type')
                setServerError(null)
              }}
              className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Change type
            </button>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-3">
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

                      <div className="flex flex-col gap-3">
                        <FormField
                          control={form.control}
                          name={`items.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Super Fine 30s Combed" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name={`items.${index}.count`}
                            render={({ field }) => (
                              <FormItem>
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
                              <FormItem>
                                <FormLabel>Unit</FormLabel>
                                <Select
                                  value={field.value || '_none_'}
                                  onValueChange={(v) => field.onChange(v === '_none_' ? '' : v)}
                                >
                                  <FormControl>
                                    <SelectTrigger className="min-h-[44px]">
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
                        </div>

                        <FormField
                          control={form.control}
                          name={`items.${index}.code`}
                          render={({ field }) => (
                            <FormItem>
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
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() =>
                    append({ name: '', count: '', unitOfMeasure: selected?.units[0] ?? '', code: '' })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add another item
                </Button>

                {serverError && <p className="text-sm text-destructive">{serverError}</p>}

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
              </form>
            </Form>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
