// Generic item-type categories tuned for the local Pakistan market. The user
// picks one of these when starting item creation; on selection the matching
// item_type row is find-or-created (see ensure-item-type action) so the whole
// batch of items is filed under the chosen category.
//
// `units` are the unit-of-measure suggestions that make sense for each trade
// (e.g. yarn is sold by Cone/Bag/Bale, greige/fabric by Than/Meter/Yard).
// `icon` is a lucide-react icon name resolved in the client wizard.

export type ItemTypePreset = {
  name: string
  description: string
  icon: string
  units: string[]
}

export const ITEM_TYPE_PRESETS: ItemTypePreset[] = [
  {
    name: 'Yarn',
    description: 'Cotton, polyester & blended yarn',
    icon: 'Layers',
    units: ['Cone', 'KG', 'Bag', 'Bale', 'Carton'],
  },
  {
    name: 'Greige',
    description: 'Grey / loom-state fabric (greige)',
    icon: 'Scissors',
    units: ['Than', 'Meter', 'Yard', 'Roll', 'KG'],
  },
  {
    name: 'Fabric',
    description: 'Finished & processed cloth',
    icon: 'Shirt',
    units: ['Than', 'Meter', 'Yard', 'Roll', 'Piece'],
  },
  {
    name: 'Electric',
    description: 'Wiring, fittings & appliances',
    icon: 'Zap',
    units: ['Piece', 'Box', 'Dozen', 'Carton', 'Meter'],
  },
  {
    name: 'Mechanical',
    description: 'Machine parts, tools & hardware',
    icon: 'Wrench',
    units: ['Piece', 'Set', 'Dozen', 'Box', 'KG'],
  },
  {
    name: 'Medicine',
    description: 'Pharma & medical supplies',
    icon: 'Pill',
    units: ['Strip', 'Box', 'Bottle', 'Piece', 'Pack'],
  },
  {
    name: 'Grocery',
    description: 'General store & food items',
    icon: 'ShoppingBasket',
    units: ['KG', 'Bag', 'Packet', 'Dozen', 'Litre', 'Piece'],
  },
  {
    name: 'Dyes',
    description: 'Reactive, disperse & pigment dyes',
    icon: 'Palette',
    units: ['KG', 'Gram', 'Bag', 'Drum', 'Packet'],
  },
  {
    name: 'Chemical',
    description: 'Industrial & textile chemicals',
    icon: 'FlaskConical',
    units: ['KG', 'Litre', 'Drum', 'Bag', 'Gallon'],
  },
]

// Fallback unit list for custom (non-preset) types.
export const DEFAULT_UNITS = ['KG', 'Piece', 'Meter', 'Yard', 'Roll', 'Bag', 'Box', 'Carton', 'Dozen'] as const

export function unitsForType(name: string): string[] {
  const preset = ITEM_TYPE_PRESETS.find((p) => p.name.toLowerCase() === name.trim().toLowerCase())
  return preset ? preset.units : [...DEFAULT_UNITS]
}
