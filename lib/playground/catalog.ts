// Standard catalog used to auto-create demo data.
//
// PREREQUISITE for item auto-creation: a one-level set of standard item_types.
// The user names the types they want; for each we look up a standard template
// here (canonical name, unit of measure, and a pool of realistic item names).
// Types we don't recognise fall back to a generic template so any input works.

export type ItemTypeTemplate = {
  /** Canonical, properly-cased type name written to item_types.name. */
  name: string
  /** Default unit_of_measure stamped on items of this type. */
  unit: string
  /** Realistic sample item names; cycled/suffixed to reach itemsPerType. */
  items: string[]
  /** Typical selling rate range (PKR) used to price demo transactions. */
  rate: [number, number]
}

/** The 1-level standard item types. Keys are lowercase match tokens. */
export const STANDARD_ITEM_TYPES: Record<string, ItemTypeTemplate> = {
  yarn: {
    name: 'Yarn',
    unit: 'kg',
    rate: [280, 850],
    items: ['Cotton Yarn 20s', 'Cotton Yarn 30s', 'Polyester Yarn 30s', 'Blended Yarn 24s', 'Combed Yarn 40s', 'Carded Yarn 16s'],
  },
  fabric: {
    name: 'Fabric',
    unit: 'meter',
    rate: [120, 600],
    items: ['Cotton Poplin', 'Lawn Print', 'Cambric White', 'Denim 12oz', 'Chiffon', 'Linen Blend'],
  },
  garment: {
    name: 'Garments',
    unit: 'pcs',
    rate: [450, 3500],
    items: ['Men Kurta', 'Ladies Shirt', 'Trouser', 'Kids Frock', 'Waistcoat', 'Shalwar Suit'],
  },
  electronics: {
    name: 'Electronics',
    unit: 'pcs',
    rate: [1500, 90000],
    items: ['LED Bulb 12W', 'Extension Board', 'USB Charger', 'Power Bank 10000mAh', 'Bluetooth Speaker', 'Wall Fan'],
  },
  grocery: {
    name: 'Grocery',
    unit: 'pcs',
    rate: [80, 1200],
    items: ['Sugar 1kg', 'Cooking Oil 1L', 'Basmati Rice 5kg', 'Tea 950g', 'Wheat Flour 10kg', 'Salt 800g'],
  },
  hardware: {
    name: 'Hardware',
    unit: 'pcs',
    rate: [50, 5000],
    items: ['Steel Screws 100pc', 'Hinges 4in', 'Door Lock', 'Paint Brush 3in', 'PVC Pipe 1in', 'Cement Bag 50kg'],
  },
  cosmetics: {
    name: 'Cosmetics',
    unit: 'pcs',
    rate: [200, 4000],
    items: ['Face Wash 100ml', 'Lipstick', 'Sunblock SPF50', 'Shampoo 400ml', 'Hair Oil 200ml', 'Body Lotion'],
  },
  pharmacy: {
    name: 'Pharmacy',
    unit: 'pcs',
    rate: [40, 1500],
    items: ['Paracetamol 500mg', 'Vitamin C', 'Antacid Syrup', 'Bandage Roll', 'Cough Syrup', 'ORS Sachet'],
  },
  stationery: {
    name: 'Stationery',
    unit: 'pcs',
    rate: [20, 900],
    items: ['A4 Paper Ream', 'Ball Pen Box', 'Register 200pg', 'Marker Set', 'File Folder', 'Glue Stick'],
  },
  furniture: {
    name: 'Furniture',
    unit: 'pcs',
    rate: [3000, 60000],
    items: ['Office Chair', 'Study Table', 'Bookshelf', 'Dining Set', 'Sofa 3-Seater', 'Bed Frame Queen'],
  },
  services: {
    name: 'Services',
    unit: 'service',
    rate: [500, 15000],
    items: ['Freight Charges', 'Installation', 'Annual Maintenance', 'Consultancy', 'Labour Charges', 'Delivery Fee'],
  },
}

/** Aliases so common variants map to a standard template. */
const ALIASES: Record<string, string> = {
  thread: 'yarn', cotton: 'yarn', textile: 'fabric', cloth: 'fabric', clothes: 'garment',
  garments: 'garment', apparel: 'garment', clothing: 'garment', electronic: 'electronics',
  groceries: 'grocery', food: 'grocery', medicine: 'pharmacy', medicines: 'pharmacy',
  medical: 'pharmacy', drugs: 'pharmacy', cosmetic: 'cosmetics', beauty: 'cosmetics',
  makeup: 'cosmetics', tools: 'hardware', service: 'services',
}

/** Resolve a free-text type name to a template (standard or a generic fallback). */
export function resolveItemType(raw: string): ItemTypeTemplate {
  const key = raw.trim().toLowerCase()
  const direct = STANDARD_ITEM_TYPES[key] ?? STANDARD_ITEM_TYPES[ALIASES[key] ?? '']
  if (direct) return direct
  // Generic fallback: keep the user's own label, invent plausible item names.
  const name = raw.trim().replace(/\b\w/g, (c) => c.toUpperCase())
  return {
    name,
    unit: 'pcs',
    rate: [100, 5000],
    items: [`${name} Standard`, `${name} Premium`, `${name} Economy`, `${name} Deluxe`, `${name} Basic`, `${name} Pro`],
  }
}

/** Pools for realistic party / people / place names. */
export const SUPPLIER_NAMES = [
  'Al-Karam Traders', 'Metro Wholesale', 'Indus Distributors', 'Faisal Enterprises', 'Zain Trading Co',
  'Star Impex', 'National Suppliers', 'Crescent Traders', 'Unity Enterprises', 'Sunrise Distributors',
  'Prime Wholesale', 'Continental Traders', 'Global Impex', 'Shalimar Traders', 'Pak Agencies',
]

export const CUSTOMER_NAMES = [
  'Ahmed Retail Store', 'Bilal Mart', 'City Center Shop', 'Deluxe Outlet', 'Everyday Store',
  'Fine Traders', 'Gulberg Store', 'Haroon Enterprises', 'Ideal Mart', 'Jinnah Store',
  'Kausar Retail', 'Liberty Shop', 'Modern Store', 'New Sale Point', 'Orient Mart',
  'Premium Outlet', 'Quality Store', 'Royal Mart', 'Saeed Traders', 'Trust Retail',
]

export const EMPLOYEE_NAMES = [
  'Muhammad Ali', 'Fatima Khan', 'Usman Sheikh', 'Ayesha Malik', 'Hamza Raza',
  'Zainab Iqbal', 'Bilal Ahmed', 'Sana Tariq', 'Omar Farooq', 'Hina Aslam',
  'Kashif Nawaz', 'Maryam Yousaf', 'Tariq Mahmood', 'Nadia Butt', 'Imran Qureshi',
]

export const DESIGNATIONS = ['Sales Executive', 'Cashier', 'Store Manager', 'Accountant', 'Helper', 'Supervisor']

export const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad', 'Multan', 'Peshawar', 'Rawalpindi', 'Sialkot']
