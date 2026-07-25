// Shared types for the Playground demo-data generator.
//
// The wizard runs entirely client-side (deterministic, no external LLM). Only
// the final generate / remove steps hit the server. These types are therefore
// imported by both the client chat component and the server actions — keep this
// file free of any server-only imports.

/** Sane upper bounds so a stray "500" can never spawn a runaway generation. */
export const LIMITS = {
  itemTypes: 12,
  itemsPerType: 20,
  locations: 20,
  employees: 50,
  suppliers: 50,
  customers: 100,
  users: 10,
  days: 365,
} as const

/** The full set of answers the wizard collects before generation. */
export type DemoConfig = {
  /** Top-level item_type names the user wants (e.g. ["Yarn", "Fabric"]). */
  itemTypes: string[]
  /** Sample items auto-created under each type. */
  itemsPerType: number
  locations: number
  employees: number
  suppliers: number
  customers: number
  /** Real assistant login accounts to create. */
  users: number
  /** Spread of days over which purchase/sale transactions are dated. */
  days: number
  /** User's stated intent to have this batch auto-removed after testing. */
  autoRemove: boolean
}

/** Per-entity counts of what was actually created, returned to the UI. */
export type DemoSummary = {
  itemTypes: number
  items: number
  locations: number
  employees: number
  suppliers: number
  customers: number
  users: number
  purchaseInvoices: number
  saleInvoices: number
}

/** A demo batch as listed on the page (for the "remove existing data" offer). */
export type DemoBatchInfo = {
  id: string
  createdAt: string
  summary: DemoSummary
}

/** Credentials for a real assistant account created during generation. */
export type DemoUserCredential = { email: string; tempPassword: string }

export type GenerateResult = {
  batchId: string
  summary: DemoSummary
  credentials: DemoUserCredential[]
}
