export type SetupData = {
  tenant: { name: string; ntn: string }
  counts: {
    accounts: number
    itemTypes: number
    locations: number
    items: number
    customers: number
    suppliers: number
    banks: number
    owners: number
    employees: number
    agents: number
    team: number
  }
  itemTypes: { id: string; name: string; parentId: string | null }[]
  locations: { id: string; name: string; address: string | null }[]
  recentItems: { id: string; name: string; sku: string; count: string | null; unit: string | null }[]
  recentCustomers: { id: string; name: string }[]
  recentSuppliers: { id: string; name: string }[]
  banks: { id: string; name: string; accountNumber: string | null; branch: string | null }[]
  owners: { id: string; name: string; sharePct: number }[]
  employees: { id: string; name: string; designation: string | null }[]
  agents: { id: string; name: string }[]
}

export type StepKey =
  | 'business'
  | 'accounts'
  | 'categories'
  | 'warehouses'
  | 'items'
  | 'customers'
  | 'suppliers'
  | 'banks'
  | 'people'
  | 'team'
  | 'review'

export type StepStatus = 'done' | 'todo' | 'optional'

export type StepDef = {
  key: StepKey
  label: string
  /** One line under the label in the rail. */
  hint: string
  /** Optional steps never block "finish"; they show as skippable. */
  optional?: boolean
  /** Where the full-featured screen for this data lives. */
  href: string
}

// Dependency order: a stock item needs a category and a warehouse before it
// can carry an opening quantity; a sale needs an item, a customer and the
// ledger. Parties come after stock because the first invoice is usually
// what prompts someone to add a customer, not the other way round.
export const STEPS: StepDef[] = [
  { key: 'business',   label: 'Business Profile',  hint: 'Name & NTN on printouts',        href: '/settings/business' },
  { key: 'accounts',   label: 'Chart of Accounts', hint: 'The ledger everything posts to', href: '/accounts' },
  { key: 'categories', label: 'Item Categories',   hint: 'Yarn, Greige, Fabric…',           href: '/item-types' },
  { key: 'warehouses', label: 'Warehouses',        hint: 'Where stock is kept',            href: '/locations' },
  { key: 'items',      label: 'Stock Items',       hint: 'What you buy and sell',          href: '/inventory' },
  { key: 'customers',  label: 'Customers',         hint: 'Who you sell to',                href: '/customers' },
  { key: 'suppliers',  label: 'Suppliers',         hint: 'Who you buy from',               href: '/suppliers' },
  { key: 'banks',      label: 'Bank Accounts',     hint: 'For cheques & transfers',        href: '/banks' },
  { key: 'people',     label: 'Owners & Staff',    hint: 'Partners, employees, agents',    href: '/owners', optional: true },
  { key: 'team',       label: 'Team Access',       hint: 'Invite an assistant',            href: '/settings/team', optional: true },
  { key: 'review',     label: 'Review & Finish',   hint: 'Opening balances & go live',     href: '/settings/opening-balances' },
]

export function stepStatus(key: StepKey, d: SetupData): StepStatus {
  const c = d.counts
  switch (key) {
    case 'business':   return d.tenant.name.trim() ? 'done' : 'todo'
    case 'accounts':   return c.accounts > 0 ? 'done' : 'todo'
    case 'categories': return c.itemTypes > 0 ? 'done' : 'todo'
    case 'warehouses': return c.locations > 0 ? 'done' : 'todo'
    case 'items':      return c.items > 0 ? 'done' : 'todo'
    case 'customers':  return c.customers > 0 ? 'done' : 'todo'
    case 'suppliers':  return c.suppliers > 0 ? 'done' : 'todo'
    case 'banks':      return c.banks > 0 ? 'done' : 'todo'
    case 'people':     return c.owners + c.employees + c.agents > 0 ? 'done' : 'optional'
    // The owner's own row is always there; "done" means someone else was added.
    case 'team':       return c.team > 1 ? 'done' : 'optional'
    case 'review':     return 'todo'
  }
}
