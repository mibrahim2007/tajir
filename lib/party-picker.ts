import type { PickerItem } from '@/components/item-picker-dialog'

export type Party = { id: string; name: string }

/**
 * Merge customers and suppliers into a single picker list, each tagged with its
 * identity ("Customer" / "Supplier"). Only the `selectable` type can be picked;
 * the other type is shown greyed out (disabled) so the user can still see it but
 * cannot select the wrong party type for the current form.
 *
 * Customer and supplier ids are UUIDs from separate tables, so they never collide.
 */
export function buildPartyItems(
  customers: Party[],
  suppliers: Party[],
  selectable: 'customer' | 'supplier',
): PickerItem[] {
  const items: PickerItem[] = [
    ...customers.map((c) => ({
      id: c.id,
      name: c.name,
      badge: 'Customer',
      disabled: selectable !== 'customer',
    })),
    ...suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      badge: 'Supplier',
      disabled: selectable !== 'supplier',
    })),
  ]
  // Sort by name so both types interleave and are easy to find; the badge keeps
  // each item's identity clear.
  return items.sort((a, b) => a.name.localeCompare(b.name))
}
