'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { createInventoryLotAction } from '@/app/actions/create-inventory-lot'
import { createLotSchema, type CreateLotInput } from '@/app/actions/inventory-lot-schema'
import { useEnterToNextField } from '@/hooks/use-enter-to-next-field'

const UOM_OPTIONS = ['KG', 'Cone', 'Meter', 'Yard', 'Roll', 'Bag', 'Bale', 'Piece', 'Bundle'] as const

type ItemType = { id: string; name: string }

export function CreateLotForm({ itemTypes }: { itemTypes: ItemType[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const handleEnterToNext = useEnterToNextField()
  const [showDuplicateLotDialog, setShowDuplicateLotDialog] = useState(false)
  const [pendingValues, setPendingValues] = useState<CreateLotInput | null>(null)

  const form = useForm<CreateLotInput>({
    resolver: zodResolver(createLotSchema),
    defaultValues: {
      name: '',
      sku: '',
      code: '',
      count: '',
      unitOfMeasure: undefined,
      itemTypeId: undefined,
      fiber: '',
      lot: '',
      defaultSupplierId: undefined,
      confirmDuplicateLot: false,
    },
  })

  const submit = (values: CreateLotInput, confirm = false) => {
    startTransition(async () => {
      setServerError(null)
      const result = await createInventoryLotAction({ ...values, confirmDuplicateLot: confirm })

      if (!result.success) {
        if (result.code === 'LOT_DUPLICATE') {
          setPendingValues(values)
          setShowDuplicateLotDialog(true)
          return
        }
        setServerError(result.error)
        return
      }

      form.reset()
      setOpen(false)
      router.refresh()
    })
  }

  const onSubmit = (values: CreateLotInput) => submit(values, false)

  const handleConfirmDuplicate = () => {
    setShowDuplicateLotDialog(false)
    if (pendingValues) submit(pendingValues, true)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            Add Stock Item
          </Button>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Stock Item</SheetTitle>
            <SheetDescription>
              Add a new inventory lot with its textile attributes.
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleEnterToNext} className="flex flex-col gap-4 mt-6">
              <FormField
                control={form.control}
                name="name"
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

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU / Barcode</FormLabel>
                    <FormControl>
                      <Input placeholder="Auto-generated (e.g. TJR-000123)" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Leave blank to auto-assign the next code.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. SF30C" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Count</FormLabel>
                    <FormControl>
                      <Input type="number" inputMode="decimal" placeholder="e.g. 10" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unitOfMeasure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measure</FormLabel>
                    <Select
                      value={field.value ?? '_none_'}
                      onValueChange={(v) => field.onChange(v === '_none_' ? undefined : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder="Select unit…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none_">No unit</SelectItem>
                        {UOM_OPTIONS.map((u) => (
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
                name="itemTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Type</FormLabel>
                    <Select
                      value={field.value ?? '_none_'}
                      onValueChange={(v) => field.onChange(v === '_none_' ? undefined : v)}
                      disabled={itemTypes.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder={itemTypes.length === 0 ? 'No types defined' : 'Select type…'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none_">No type</SelectItem>
                        {itemTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {itemTypes.length === 0 && (
                      <p className="text-xs text-muted-foreground">Add item types in Settings → Item Types</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fiber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fiber</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Cotton, Polyester" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lot</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. L-2024-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError && <p className="text-sm text-destructive">{serverError}</p>}

              <Button
                type="submit"
                className="w-full min-h-[44px]"
                disabled={isPending}
              >
                {isPending ? 'Creating…' : 'Create Stock Item'}
              </Button>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <Dialog open={showDuplicateLotDialog} onOpenChange={setShowDuplicateLotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lot already exists</DialogTitle>
            <DialogDescription>
              A stock item with Lot &ldquo;{pendingValues?.lot}&rdquo; already exists. Do you want
              to create a new entry with the same lot number, or cancel and enter a different lot?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateLotDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDuplicate} disabled={isPending}>
              Create New
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
