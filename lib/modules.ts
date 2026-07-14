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
  HandCoins,
  Banknote,
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
  | 'employees'
  | 'loans'

export const ALL_MODULES: ModuleKey[] = [
  'inventory', 'purchases', 'purchase_returns', 'sales', 'sale_returns',
  'gatepasses', 'locations', 'stock_transfers',
  'customers', 'receipts', 'credit_notes', 'suppliers', 'payments',
  'debit_notes', 'pricing', 'expenses',
  'accounts', 'vouchers', 'reports', 'employees', 'loans',
]

export const MODULE_META: Record<ModuleKey, { label: string; section: string; icon: React.ElementType; href: string }> = {
  // ── Sales (selling to customers) ──
  sales:            { label: 'Sales',              section: 'Sales',        icon: ShoppingBag,   href: '/sales' },
  sale_returns:     { label: 'Sale Returns',       section: 'Sales',        icon: RefreshCcw,    href: '/sale-returns' },
  customers:        { label: 'Customers',          section: 'Sales',        icon: Users,         href: '/customers' },
  receipts:         { label: 'Receipts',           section: 'Sales',        icon: ArrowDownLeft, href: '/receipts' },
  credit_notes:     { label: 'Credit Notes',       section: 'Sales',        icon: FileMinus,     href: '/credit-notes' },
  pricing:          { label: 'Pricing',            section: 'Sales',        icon: Tag,           href: '/pricing' },
  // ── Procurement (buying from suppliers) ──
  purchases:        { label: 'Purchases',          section: 'Procurement',  icon: ShoppingCart,  href: '/purchases' },
  purchase_returns: { label: 'Purchase Returns',   section: 'Procurement',  icon: Undo2,         href: '/purchase-returns' },
  suppliers:        { label: 'Suppliers',          section: 'Procurement',  icon: Truck,         href: '/suppliers' },
  payments:         { label: 'Payments',           section: 'Procurement',  icon: ArrowUpRight,  href: '/payments' },
  debit_notes:      { label: 'Debit Notes',        section: 'Procurement',  icon: FilePlus,      href: '/debit-notes' },
  // ── Inventory (stock) ──
  inventory:        { label: 'Inventory',          section: 'Inventory',    icon: Package,       href: '/inventory' },
  stock_transfers:  { label: 'Stock Transfers',    section: 'Inventory',    icon: ArrowLeftRight, href: '/stock-transfers' },
  locations:        { label: 'Locations',          section: 'Inventory',    icon: MapPin,        href: '/locations' },
  gatepasses:       { label: 'Gatepasses',         section: 'Inventory',    icon: ClipboardList, href: '/gatepasses' },
  // ── Accounts (accounting & reporting) ──
  accounts:         { label: 'Accounts',           section: 'Accounts',     icon: BookOpen,      href: '/accounts' },
  vouchers:         { label: 'Vouchers',           section: 'Accounts',     icon: PenLine,       href: '/vouchers' },
  reports:          { label: 'Reports',            section: 'Accounts',     icon: BarChart2,     href: '/reports' },
  expenses:         { label: 'Expenses',           section: 'Accounts',     icon: Receipt,       href: '/expenses' },
  employees:        { label: 'Employees',          section: 'Accounts',     icon: HandCoins,     href: '/employees' },
  loans:            { label: 'Loans',               section: 'Accounts',     icon: Banknote,      href: '/loans' },
}

/** Modules enabled by default when tenant has no features config */
export const DEFAULT_TENANT_FEATURES = new Set<ModuleKey>(ALL_MODULES)

/** Modules an assistant can access by default when user has no permissions config */
export const DEFAULT_ASSISTANT_PERMISSIONS = new Set<ModuleKey>([
  'inventory', 'purchases', 'purchase_returns', 'sales', 'sale_returns',
  'gatepasses', 'stock_transfers',
  'receipts', 'payments', 'employees', 'loans',
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
