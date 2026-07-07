import type { PickerItem } from '@/components/item-picker-dialog'

export type Party = { id: string; name: string }

/**
 * Merge customers and suppliers into a single picker list, each tagged with its
 * identity ("Customer" / "Supplier"). Both types are selectable — when the user
 * picks the type a form doesn't natively store, the form mirrors it via
 * resolvePartyAction at save time so the FK stays valid.
 *
 * Customer and supplier ids are UUIDs from separate tables, so they never collide.
 */
export function buildPartyItems(customers: Party[], suppliers: Party[]): PickerItem[] {
  const items: PickerItem[] = [
    ...customers.map((c) => ({ id: c.id, name: c.name, badge: 'Customer' })),
    ...suppliers.map((s) => ({ id: s.id, name: s.name, badge: 'Supplier' })),
  ]
  // Sort by name so both types interleave and are easy to find; the badge keeps
  // each item's identity clear.
  return items.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Given a picked party id and the set of known ids of the type a form stores
 * natively (e.g. customers on a sale), report whether the pick needs mirroring.
 */
export function needsMirror(pickedId: string, nativeIds: Iterable<string>): boolean {
  for (const id of nativeIds) if (id === pickedId) return false
  return !!pickedId
}
