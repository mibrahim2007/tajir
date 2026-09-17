import {
  LayoutDashboard, Sparkles, Search, Lock, Landmark, BookOpen, Video, Layers,
  LifeBuoy, Settings, Building2, UserCog, FlaskConical, UsersRound, Wallet,
  Package, ShoppingCart, ShoppingBag, ClipboardList, ArrowDownLeft, ArrowUpRight,
  Receipt, PenLine, BarChart2, HandCoins, Banknote, Handshake, Tag, Users, Truck, Wand2,
  RefreshCcw, Undo2, FileMinus, FilePlus, MapPin, ArrowLeftRight, Coins, Boxes, KeyRound,
} from 'lucide-react'
import { type ModuleKey } from './modules'

/*
 * The navigation model.
 *
 * The menu used to be one flat list of thirty-seven links across four screens of
 * scroll, in which "record a sale" and "browse the sales list" looked identical
 * and all twenty-two reports hid behind a single `Reports` row. Two changes fix
 * that, and both live here rather than in the sidebar component so the structure
 * can be read in one place:
 *
 *   1. Creating something is its own thing. NEW_ACTIONS is pinned to the top of
 *      the menu, so the forms people use every hour are one click from anywhere
 *      instead of being reached by finding a list and hunting for its button.
 *
 *   2. Everything else is grouped under six task words a trader would actually
 *      say — Sell, Buy, Stock, Money, Reports, Setup — and each group stays shut
 *      until it is opened. The menu is never longer than a screen.
 *
 * MODULE_META still owns the per-module permission matrix (the Modules and Team
 * settings screens group by its `section`), so this file deliberately does not
 * touch it. It only decides where things appear in the menu.
 */

export type NavItem = {
  href: string
  label: string
  icon?: React.ElementType
  /** Hidden unless the tenant/user has this module. Undefined = always shown. */
  module?: ModuleKey
  /** Hidden from assistants. */
  ownerOnly?: boolean
}

export type NavSection = {
  key: string
  label: string
  icon: React.ElementType
  ownerOnly?: boolean
  /** A flat section. */
  items?: NavItem[]
  /** A sectioned section — used by Reports, which is too long to read flat. */
  groups?: { title: string; items: NavItem[] }[]
}

/**
 * The entry forms, pinned above everything else.
 *
 * Deliberately six: these are the documents a trading office raises daily. A
 * longer list would re-create the wall of links this block exists to escape —
 * everything rarer is one click deeper, inside its section.
 */
export const NEW_ACTIONS: NavItem[] = [
  { href: '/sales/new',      label: 'Sale',     icon: ShoppingBag,   module: 'sales' },
  { href: '/purchases/new',  label: 'Purchase', icon: ShoppingCart,  module: 'purchases' },
  { href: '/receipts/new',   label: 'Receipt',  icon: ArrowDownLeft, module: 'receipts' },
  { href: '/payments/new',   label: 'Payment',  icon: ArrowUpRight,  module: 'payments' },
  { href: '/expenses/new',   label: 'Expense',  icon: Receipt,       module: 'expenses' },
  { href: '/gatepasses/new', label: 'Gatepass', icon: ClipboardList, module: 'gatepasses' },
]

/** Always visible, above the collapsible groups. */
export const PINNED: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/ask',       label: 'Ask',       icon: Sparkles },
]

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'sell',
    label: 'Sell',
    icon: Coins,
    items: [
      { href: '/sales',         label: 'Sales',        icon: ShoppingBag,   module: 'sales' },
      { href: '/sale-returns',  label: 'Sale Returns', icon: RefreshCcw,    module: 'sale_returns' },
      { href: '/customers',     label: 'Customers',    icon: Users,         module: 'customers' },
      { href: '/receipts',      label: 'Receipts',     icon: ArrowDownLeft, module: 'receipts' },
      { href: '/credit-notes',  label: 'Credit Notes', icon: FileMinus,     module: 'credit_notes' },
      { href: '/pricing',       label: 'Pricing',      icon: Tag,           module: 'pricing' },
    ],
  },
  {
    key: 'buy',
    label: 'Buy',
    icon: ShoppingCart,
    items: [
      { href: '/purchases',        label: 'Purchases',        icon: ShoppingCart, module: 'purchases' },
      { href: '/purchase-returns', label: 'Purchase Returns', icon: Undo2,        module: 'purchase_returns' },
      { href: '/suppliers',        label: 'Suppliers',        icon: Truck,        module: 'suppliers' },
      { href: '/payments',         label: 'Payments',         icon: ArrowUpRight, module: 'payments' },
      { href: '/debit-notes',      label: 'Debit Notes',      icon: FilePlus,     module: 'debit_notes' },
    ],
  },
  {
    key: 'stock',
    label: 'Stock',
    icon: Boxes,
    items: [
      { href: '/inventory',       label: 'Inventory',       icon: Package,        module: 'inventory' },
      { href: '/stock-transfers', label: 'Stock Transfers', icon: ArrowLeftRight, module: 'stock_transfers' },
      { href: '/gatepasses',      label: 'Gatepasses',      icon: ClipboardList,  module: 'gatepasses' },
      { href: '/locations',       label: 'Locations',       icon: MapPin,         module: 'locations' },
    ],
  },
  {
    key: 'money',
    label: 'Money',
    icon: Landmark,
    items: [
      { href: '/expenses',  label: 'Expenses',  icon: Receipt,   module: 'expenses' },
      { href: '/vouchers',  label: 'Vouchers',  icon: PenLine,   module: 'vouchers' },
      { href: '/accounts',  label: 'Accounts',  icon: BookOpen,  module: 'accounts' },
      { href: '/employees', label: 'Employees', icon: HandCoins, module: 'employees' },
      { href: '/loans',     label: 'Loans',     icon: Banknote,  module: 'loans' },
      { href: '/agents',    label: 'Agents',    icon: Handshake, module: 'agents' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: BarChart2,
    /*
     * Twenty-two reports read as noise in one list, so they are grouped by the
     * question being asked rather than by which table they read. "Where is my
     * money" and "what is my stock worth" are how people arrive at a report;
     * "general ledger" is not.
     */
    groups: [
      {
        title: 'All',
        items: [
          { href: '/reports', label: 'Browse all reports' },
        ],
      },
      {
        title: 'Money',
        items: [
          { href: '/reports/cashbook',           label: 'Daily Cashbook' },
          { href: '/reports/bank-statement',     label: 'Bank Statement' },
          { href: '/reports/pdc-register',       label: 'Cheque Register' },
          { href: '/reports/receivables-aging',  label: 'Receivables Aging' },
          { href: '/reports/payables-aging',     label: 'Payables Aging' },
          { href: '/reports/employee-loans',     label: 'Employee Loans' },
        ],
      },
      {
        title: 'Sales & Purchases',
        items: [
          { href: '/reports/sale-detail',            label: 'Sale Detail' },
          { href: '/reports/purchase-detail',        label: 'Purchase Detail' },
          { href: '/reports/purchases-sales',        label: 'Purchase & Sales' },
          { href: '/reports/customer-profit-loss',   label: 'Customer Profit & Loss' },
          { href: '/reports/item-profit-loss',       label: 'Item Profit & Loss' },
          { href: '/reports/pending-balance',        label: 'Pending Balance' },
        ],
      },
      {
        title: 'Stock',
        items: [
          { href: '/reports/stock-summary',   label: 'Stock Summary' },
          { href: '/reports/stock-valuation', label: 'Stock Valuation' },
          { href: '/reports/location-stock',  label: 'Location-wise Stock' },
          { href: '/reports/item-ledger',     label: 'Item Ledger' },
        ],
      },
      {
        title: 'Accounting',
        items: [
          { href: '/reports/profit-loss',          label: 'Profit & Loss' },
          { href: '/reports/balance-sheet',        label: 'Balance Sheet' },
          { href: '/reports/trial-balance',        label: 'Trial Balance' },
          { href: '/reports/general-ledger',       label: 'General Ledger' },
          { href: '/reports/consolidated-ledger',  label: 'Consolidated Ledger' },
          { href: '/reports/custom',               label: 'Custom Reports' },
        ],
      },
    ],
  },
  {
    key: 'setup',
    label: 'Setup',
    icon: Settings,
    ownerOnly: true,
    items: [
      { href: '/settings/setup',            label: 'Setup Wizard',     icon: Wand2 },
      { href: '/settings/business',         label: 'Business',         icon: Building2 },
      { href: '/settings/team',             label: 'Team',             icon: UsersRound },
      { href: '/settings/modules',          label: 'Modules',          icon: Settings },
      { href: '/owners',                    label: 'Owners',           icon: UserCog },
      { href: '/item-types',                label: 'Item Types',       icon: Layers },
      { href: '/banks',                     label: 'Banks',            icon: Landmark },
      { href: '/settings/opening-balances', label: 'Opening Balances', icon: Wallet },
      { href: '/settings/period-lock',      label: 'Close the Books',  icon: Lock },
      { href: '/settings/api-keys',         label: 'API Keys',         icon: KeyRound },
      { href: '/audit',                     label: 'Audit Log',        icon: Search },
      { href: '/playground',                label: 'Demo Playground',  icon: FlaskConical },
    ],
  },
  {
    key: 'help',
    label: 'Help',
    icon: LifeBuoy,
    items: [
      { href: '/support',    label: 'Support',     icon: LifeBuoy },
      { href: '/help',       label: 'Help Videos', icon: Video },
      { href: '/user-guide', label: 'User Guide',  icon: BookOpen },
    ],
  },
]

/** Drops anything the tenant has switched off or this user may not see. */
export function visibleItems(items: NavItem[], enabled: Set<ModuleKey>, isOwner: boolean): NavItem[] {
  return items.filter((i) => {
    if (i.ownerOnly && !isOwner) return false
    if (i.module && !enabled.has(i.module)) return false
    return true
  })
}

/** The sections that still have something in them for this user. */
export function visibleSections(enabled: Set<ModuleKey>, isOwner: boolean): NavSection[] {
  return NAV_SECTIONS.flatMap((s) => {
    if (s.ownerOnly && !isOwner) return []
    if (s.groups) return [s]
    const items = visibleItems(s.items ?? [], enabled, isOwner)
    return items.length > 0 ? [{ ...s, items }] : []
  })
}

/**
 * Which section holds the current route, so the menu can open itself to where
 * the user already is instead of making them remember where they came from.
 * Longest match wins, so /reports/sale-detail resolves to Reports rather than
 * to whichever section merely shares a prefix.
 */
export function sectionForPath(pathname: string, sections: NavSection[]): string | null {
  let best: { key: string; len: number } | null = null
  for (const s of sections) {
    const items = s.groups ? s.groups.flatMap((g) => g.items) : (s.items ?? [])
    for (const i of items) {
      if ((pathname === i.href || pathname.startsWith(i.href + '/')) && (!best || i.href.length > best.len)) {
        best = { key: s.key, len: i.href.length }
      }
    }
  }
  return best?.key ?? null
}
