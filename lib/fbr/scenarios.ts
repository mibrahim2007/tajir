/*
 * FBR Digital Invoicing reference data that does not come from an API:
 * sandbox scenarios, which of them apply to a business activity / sector, and
 * fallback lists used until the tenant's token can fetch FBR's own lists.
 *
 * Source: PRAL "Technical Specification for DI API" v1.12, sections 9 and 10.
 */

export type BuyerType = 'Registered' | 'Unregistered'

export type Scenario = {
  id: string
  description: string
  /** FBR "saleType" value sent on every line of the invoice. */
  saleType: string
  /** Suggested rate (ratE_DESC); editable on the line. Empty = the user must enter it. */
  defaultRate: string
  /** The buyer type this scenario is built around, when it has one. */
  buyer?: BuyerType
  /** Line needs the notified / retail price (3rd Schedule). */
  retailPrice?: boolean
}

export const SCENARIOS: Scenario[] = [
  { id: 'SN001', description: 'Goods at standard rate to registered buyers',   saleType: 'Goods at standard rate (default)', defaultRate: '18%', buyer: 'Registered' },
  { id: 'SN002', description: 'Goods at standard rate to unregistered buyers', saleType: 'Goods at standard rate (default)', defaultRate: '18%', buyer: 'Unregistered' },
  { id: 'SN003', description: 'Sale of Steel (Melted and Re-Rolled)',          saleType: 'Steel Melting and re-rolling',     defaultRate: '' },
  { id: 'SN004', description: 'Sale by Ship Breakers',                         saleType: 'Ship breaking',                    defaultRate: '' },
  { id: 'SN005', description: 'Reduced rate sale',                             saleType: 'Goods at Reduced Rate',            defaultRate: '' },
  { id: 'SN006', description: 'Exempt goods sale',                             saleType: 'Exempt goods',                     defaultRate: 'Exempt' },
  { id: 'SN007', description: 'Zero rated sale',                               saleType: 'Goods at zero-rate',               defaultRate: '0%' },
  { id: 'SN008', description: 'Sale of 3rd schedule goods',                    saleType: '3rd Schedule Goods',               defaultRate: '18%', retailPrice: true },
  { id: 'SN009', description: 'Cotton spinners purchase from cotton ginners',  saleType: 'Cotton ginners',                   defaultRate: '' },
  { id: 'SN010', description: 'Telecom services rendered or provided',         saleType: 'Telecommunication services',       defaultRate: '' },
  { id: 'SN011', description: 'Toll manufacturing sale by steel sector',       saleType: 'Toll Manufacturing',               defaultRate: '' },
  { id: 'SN012', description: 'Sale of petroleum products',                    saleType: 'Petroleum Products',               defaultRate: '' },
  { id: 'SN013', description: 'Electricity supply to retailers',               saleType: 'Electricity Supply to Retailers',  defaultRate: '' },
  { id: 'SN014', description: 'Sale of gas to CNG stations',                   saleType: 'Gas to CNG stations',              defaultRate: '' },
  { id: 'SN015', description: 'Sale of mobile phones',                         saleType: 'Mobile Phones',                    defaultRate: '' },
  { id: 'SN016', description: 'Processing / conversion of goods',              saleType: 'Processing/Conversion of Goods',   defaultRate: '' },
  { id: 'SN017', description: 'Sale of goods where FED is charged in ST mode', saleType: 'Goods (FED in ST Mode)',           defaultRate: '' },
  { id: 'SN018', description: 'Services where FED is charged in ST mode',      saleType: 'Services (FED in ST Mode)',        defaultRate: '' },
  { id: 'SN019', description: 'Services rendered or provided',                 saleType: 'Services',                         defaultRate: '' },
  { id: 'SN020', description: 'Sale of electric vehicles',                     saleType: 'Electric Vehicle',                 defaultRate: '' },
  { id: 'SN021', description: 'Sale of cement / concrete block',               saleType: 'Cement /Concrete Block',           defaultRate: '' },
  { id: 'SN022', description: 'Sale of potassium chlorate',                    saleType: 'Potassium Chlorate',               defaultRate: '' },
  { id: 'SN023', description: 'Sale of CNG',                                   saleType: 'CNG Sales',                        defaultRate: '' },
  { id: 'SN024', description: 'Goods listed in SRO 297(I)/2023',               saleType: 'Goods as per SRO.297(|)/2023',     defaultRate: '' },
  { id: 'SN025', description: 'Drugs at fixed ST rate (8th Schedule, serial 81)', saleType: 'Non-Adjustable Supplies',       defaultRate: '' },
  { id: 'SN026', description: 'Sale to end consumer by retailers (standard rate)', saleType: 'Goods at standard rate (default)', defaultRate: '18%', buyer: 'Unregistered' },
  { id: 'SN027', description: 'Sale to end consumer by retailers (3rd Schedule)',  saleType: '3rd Schedule Goods',           defaultRate: '18%', buyer: 'Unregistered', retailPrice: true },
  { id: 'SN028', description: 'Sale to end consumer by retailers (reduced rate)',  saleType: 'Goods at Reduced Rate',        defaultRate: '', buyer: 'Unregistered' },
]

export const BUSINESS_ACTIVITIES = [
  'Manufacturer', 'Importer', 'Distributor', 'Wholesaler', 'Exporter', 'Retailer', 'Service Provider', 'Other',
] as const

export const SECTORS = [
  'All Other Sectors', 'Steel', 'FMCG', 'Textile', 'Telecom', 'Petroleum', 'Electricity Distribution',
  'Gas Distribution', 'Services', 'Automobile', 'CNG Stations', 'Pharmaceuticals', 'Wholesale / Retails',
] as const

const n = (...ids: number[]) => ids.map((i) => `SN${String(i).padStart(3, '0')}`)
const BASE = n(1, 2, 5, 6, 7, 15, 16, 17, 21, 22, 24)
const SECTOR_EXTRA: Record<string, string[]> = {
  'All Other Sectors': [], Steel: n(3, 4, 11), FMCG: n(8), Textile: n(9), Telecom: n(10), Petroleum: n(12),
  'Electricity Distribution': n(13), 'Gas Distribution': n(14), Services: n(18, 19), Automobile: n(20),
  'CNG Stations': n(23), Pharmaceuticals: n(25), 'Wholesale / Retails': n(26, 27, 28, 8),
}
const RETAIL = n(26, 27, 28, 8)

/** Section 10 of the spec: scenarios a taxpayer must pass in sandbox. */
export function applicableScenarios(activity: string | null, sector: string | null): string[] {
  if (!activity || !sector) return []
  const extra = SECTOR_EXTRA[sector] ?? []
  let ids: string[]
  switch (activity) {
    case 'Manufacturer':
      ids = sector === 'Steel' ? extra : sector === 'Pharmaceuticals' ? BASE : [...BASE, ...extra]
      break
    case 'Importer': case 'Exporter': case 'Other':
      ids = [...BASE, ...extra]
      break
    case 'Distributor': case 'Wholesaler':
      ids = sector === 'All Other Sectors' ? [...BASE, ...RETAIL]
        : sector === 'Wholesale / Retails' ? [...n(1, 2), ...RETAIL]
        : [...extra, ...RETAIL]
      break
    case 'Retailer':
      ids = sector === 'All Other Sectors' ? [...BASE, ...RETAIL]
        : sector === 'Steel' ? extra
        : [...extra, ...RETAIL]
      break
    case 'Service Provider':
      ids = sector === 'All Other Sectors' ? [...BASE, ...n(18, 19)]
        : sector === 'Services' ? n(18, 19)
        : [...extra, ...n(18, 19)]
      break
    default:
      ids = []
  }
  return [...new Set(ids)].sort()
}

export const scenarioById = (id: string | null | undefined) => SCENARIOS.find((s) => s.id === id)

/**
 * Default scenario for a buyer type: standard-rate goods (SN001 registered /
 * SN002 unregistered). These two are always offered, whatever the activity
 * table says, because they are the everyday registered / unregistered sale.
 */
export function defaultScenario(buyer: BuyerType): string {
  return buyer === 'Registered' ? 'SN001' : 'SN002'
}

export const ALWAYS_OFFERED = ['SN001', 'SN002']

// Used until a connection test caches FBR's own lists (reference APIs 5.1 / 5.6).
export const FALLBACK_PROVINCES = [
  'PUNJAB', 'SINDH', 'KHYBER PAKHTUNKHWA', 'BALOCHISTAN', 'CAPITAL TERRITORY', 'GILGIT BALTISTAN', 'AZAD JAMMU AND KASHMIR',
]
export const FALLBACK_UOMS = [
  'KG', 'Numbers, pieces, units', 'Meter', 'Square Metre', 'MT', 'Pound', 'Bag', 'Litre', 'Dozen', 'Pair', 'Yard', 'Bale',
]
export const RATE_SUGGESTIONS = ['18%', '17%', '16%', '10%', '8%', '5%', '1%', '0%', 'Exempt']

/** "18%" → 0.18; "Exempt" / unparsable → 0. "18% along with rupees 60 per kilogram" → 0.18. */
export function rateFraction(rate: string): number {
  const m = /([\d.]+)\s*%/.exec(rate)
  return m ? Number(m[1]) / 100 : 0
}
