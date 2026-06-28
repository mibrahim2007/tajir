export type Customer = { id: string; name: string }
export type Supplier = { id: string; name: string }
export type StockItem = { id: string; name: string; count: string; current_quantity: string }
export type Location  = { id: string; name: string }

export type LocationStock = {
  location_id: string
  location_name: string
  quantity: number
}

export type LedgerEntry = {
  date: string
  description: string
  debit: number
  credit: number
  balance: number
}
