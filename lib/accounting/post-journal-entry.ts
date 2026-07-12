import { createAdminClient } from '@/lib/supabase/admin'

type JournalLine = {
  accountSystemKey: string
  description?: string
  debit: number
  credit: number
  customerId?: string
  supplierId?: string
  stockItemId?: string
}

type PostJournalEntryParams = {
  tenantId: string
  date: string
  description: string
  reference?: string | null
  sourceType: string
  sourceId: string
  prefix: string
  lines: JournalLine[]
  // When re-posting an edited document, pass the original voucher number to
  // keep it stable instead of drawing a fresh one from the sequence.
  voucherNumber?: string
}

export async function postJournalEntry(params: PostJournalEntryParams): Promise<void> {
  const { tenantId, date, description, reference, sourceType, sourceId, prefix, lines, voucherNumber: reuseVoucher } = params
  const admin = createAdminClient()

  // Look up all account IDs by system_key in one query
  const systemKeys = [...new Set(lines.map((l) => l.accountSystemKey))]
  const { data: accounts } = await admin
    .from('chart_of_accounts')
    .select('id, system_key')
    .eq('tenant_id', tenantId)
    .in('system_key', systemKeys)

  if (!accounts || accounts.length === 0) return // CoA not seeded yet — skip silently

  const accountMap = new Map(accounts.map((a) => [a.system_key, a.id]))

  // Verify all required accounts exist
  const missingKeys = systemKeys.filter((k) => !accountMap.has(k))
  if (missingKeys.length > 0) return // partial CoA — skip silently

  // Resolve the party (customer or supplier) named on the entry so the stored
  // narration reads "Party — DocNo — Date — Type" and the reference holds the
  // source document number.
  const partyCustomerId = lines.find((l) => l.customerId)?.customerId
  const partySupplierId = lines.find((l) => l.supplierId)?.supplierId
  let partyName: string | null = null
  if (partyCustomerId) {
    const { data: cust } = await admin
      .from('tajir_customers').select('name').eq('id', partyCustomerId).eq('tenant_id', tenantId).maybeSingle()
    partyName = cust?.name ?? null
  } else if (partySupplierId) {
    const { data: supp } = await admin
      .from('suppliers').select('name').eq('id', partySupplierId).eq('tenant_id', tenantId).maybeSingle()
    partyName = supp?.name ?? null
  }

  const fullDescription = [partyName, reference, date, description].filter(Boolean).join(' — ')

  // Reuse the caller-supplied voucher (edits) or draw the next one atomically
  let voucherNumber = reuseVoucher ?? null
  if (!voucherNumber) {
    const { data: voucherRow } = await admin
      .rpc('get_next_voucher_number', { p_tenant_id: tenantId, p_prefix: prefix })
    voucherNumber = voucherRow as string | null
  }
  if (!voucherNumber) return

  // Insert journal entry header
  const { data: entry, error: entryError } = await admin
    .from('tajir_journal_entries')
    .insert({
      tenant_id:      tenantId,
      voucher_number: voucherNumber,
      date,
      description:    fullDescription,
      reference:      reference ?? null,
      source_type:    sourceType,
      source_id:      sourceId,
    })
    .select('id')
    .single()

  if (entryError || !entry) return

  // Insert all lines
  const lineRows = lines.map((l) => ({
    journal_entry_id: entry.id,
    tenant_id:        tenantId,
    account_id:       accountMap.get(l.accountSystemKey)!,
    description:      l.description ?? null,
    debit:            l.debit,
    credit:           l.credit,
    customer_id:      l.customerId ?? null,
    supplier_id:      l.supplierId ?? null,
    stock_item_id:    l.stockItemId ?? null,
  }))

  await admin.from('tajir_journal_entry_lines').insert(lineRows)
}
