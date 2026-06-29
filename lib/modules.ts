import {
  Package,
  ShoppingCart,
  Undo2,
  ShoppingBag,
  RefreshCcw,
  ClipboardList,
  MapPin,
  ArrowLeftRight,
  Users,
  ArrowDownLeft,
  FileMinus,
  Truck,
  ArrowUpRight,
  FilePlus,
  Tag,
  Receipt,
  BookOpen,
  PenLine,
  BarChart2,
} from 'lucide-react'

export type ModuleKey =
  | 'inventory'
  | 'purchases'
  | 'purchase_returns'
  | 'sales'
  | 'sale_returns'
  | 'gatepasses'
  | 'locations'
  | 'stock_transfers'
  | 'customers'
  | 'receipts'
  | 'credit_notes'
  | 'suppliers'
  | 'payments'
  | 'debit_notes'
  | 'pricing'
  | 'expenses'
  | 'accounts'
  | 'vouchers'
  | 'reports'

export const ALL_MODULES: ModuleKey[] = [
  'inventory', 'purchases', 'purchase_returns', 'sales', 'sale_returns',
  'gatepasses', 'locations', 'stock_transfers',
  'customers', 'receipts', 'credit_notes', 'suppliers', 'payments',
  'debit_notes', 'pricing', 'expenses',
  'accounts', 'vouchers', 'reports',
]

export const MODULE_META: Record<ModuleKey, { label: string; section: string; icon: React.ElementType; href: string }> = {
  inventory:        { label: 'Inventory',         section: 'Trading',     icon: Package,       href: '/inventory' },
  purchases:        { label: 'Purchases',          section: 'Trading',     icon: ShoppingCart,  href: '/purchases' },
  purchase_returns: { label: 'Purchase Returns',   section: 'Trading',     icon: Undo2,         href: '/purchase-returns' },
  sales:            { label: 'Sales',              section: 'Trading',     icon: ShoppingBag,   href: '/sales' },
  sale_returns:     { label: 'Sale Returns',       section: 'Trading',     icon: RefreshCcw,    href: '/sale-returns' },
  gatepasses:       { label: 'Gatepasses',         section: 'Trading',     icon: ClipboardList, href: '/gatepasses' },
  locations:        { label: 'Locations',          section: 'Trading',     icon: MapPin,        href: '/locations' },
  stock_transfers:  { label: 'Stock Transfers',    section: 'Trading',     icon: ArrowLeftRight, href: '/stock-transfers' },
  customers:        { label: 'Customers',          section: 'Finance',     icon: Users,         href: '/customers' },
  receipts:         { label: 'Receipts',           section: 'Finance',     icon: ArrowDownLeft, href: '/receipts' },
  credit_notes:     { label: 'Credit Notes',       section: 'Finance',     icon: FileMinus,     href: '/credit-notes' },
  suppliers:        { label: 'Suppliers',          section: 'Finance',     icon: Truck,         href: '/suppliers' },
  payments:         { label: 'Payments',           section: 'Finance',     icon: ArrowUpRight,  href: '/payments' },
  debit_notes:      { label: 'Debit Notes',        section: 'Finance',     icon: FilePlus,      href: '/debit-notes' },
  pricing:          { label: 'Pricing',            section: 'Finance',     icon: Tag,           href: '/pricing' },
  expenses:         { label: 'Expenses',           section: 'Finance',     icon: Receipt,       href: '/expenses' },
  accounts:         { label: 'Accounts',           section: 'Accounting',  icon: BookOpen,      href: '/accounts' },
  vouchers:         { label: 'Vouchers',           section: 'Accounting',  icon: PenLine,       href: '/vouchers' },
  reports:          { label: 'Reports',            section: 'Accounting',  icon: BarChart2,     href: '/reports' },
}

/** Modules enabled by default when tenant has no features config */
export const DEFAULT_TENANT_FEATURES = new Set<ModuleKey>(ALL_MODULES)

/** Modules an assistant can access by default when user has no permissions config */
export const DEFAULT_ASSISTANT_PERMISSIONS = new Set<ModuleKey>([
  'inventory', 'purchases', 'purchase_returns', 'sales', 'sale_returns',
  'gatepasses', 'stock_transfers',
  'receipts', 'payments',
])

export function parseTenantFeatures(raw: unknown): Set<ModuleKey> {
  if (!raw || !Array.isArray(raw)) return new Set(ALL_MODULES)
  return new Set(raw.filter((k): k is ModuleKey => ALL_MODULES.includes(k as ModuleKey)))
}

export function parseUserPermissions(raw: unknown): Set<ModuleKey> | null {
  if (raw === null || raw === undefined) return null
  if (!Array.isArray(raw)) return null
  return new Set(raw.filter((k): k is ModuleKey => ALL_MODULES.includes(k as ModuleKey)))
}

export function computeEffectiveModules(
  role: string,
  tenantFeatures: Set<ModuleKey>,
  userPermissions: Set<ModuleKey> | null,
): Set<ModuleKey> {
  if (role === 'owner') return tenantFeatures
  // Assistant: intersection of tenant features with their permissions
  const perms = userPermissions ?? DEFAULT_ASSISTANT_PERMISSIONS
  return new Set([...tenantFeatures].filter((m) => perms.has(m)))
}
