import { createAdminClient } from '@/lib/supabase/admin'

type JournalLine = {
  accountSystemKey: string
  description?: string
  debit: number
  credit: number
  customerId?: string
  supplierId?: string
  stockItemId?: string
  employeeId?: string
  ownerId?: string
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
  // Suppress the party-name prefix on the narration. Set this for entries that
  // span SEVERAL parties (e.g. a profit allocation across all owners), where
  // naming only the first one would misdescribe the entry.
  suppressPartyName?: boolean
}

/**
 * Outcome of a posting attempt.
 *
 * Historically this function returned `void` and simply gave up on any problem,
 * so a caller could write its document row while the journal entry silently
 * vanished — the books under-reported and nothing surfaced it. It now reports
 * what happened. Callers that ignore the result behave exactly as before, but
 * every failure is logged so it shows up in the server logs / Sentry.
 */
export type PostJournalEntryResult =
  | { ok: true; voucherNumber: string }
  | { ok: false; reason: PostFailureReason; message: string }

export type PostFailureReason =
  | 'coa_not_seeded'
  | 'missing_account'
  | 'no_voucher_number'
  | 'header_insert_failed'
  | 'lines_insert_failed'

function fail(
  reason: PostFailureReason,
  message: string,
  ctx: { tenantId: string; sourceType: string; sourceId: string },
): { ok: false; reason: PostFailureReason; message: string } {
  // Loud on purpose: these were the silent paths.
  console.error(
    `[postJournalEntry] ${reason}: ${message} ` +
      `(tenant=${ctx.tenantId} source=${ctx.sourceType}/${ctx.sourceId})`,
  )
  return { ok: false, reason, message }
}

export async function postJournalEntry(params: PostJournalEntryParams): Promise<PostJournalEntryResult> {
  const { tenantId, date, description, reference, sourceType, sourceId, prefix, lines, voucherNumber: reuseVoucher, suppressPartyName } = params
  const admin = createAdminClient()
  const ctx = { tenantId, sourceType, sourceId }

  // Warn on an unbalanced entry but still post it: refusing here would turn a
  // slightly-off entry into a MISSING one for the many callers that ignore this
  // result, which is strictly worse. Surfaced so it can be chased down.
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    console.error(
      `[postJournalEntry] UNBALANCED entry: debits=${totalDebit} credits=${totalCredit} ` +
        `(tenant=${tenantId} source=${sourceType}/${sourceId})`,
    )
  }

  // Look up all account IDs by system_key in one query
  const systemKeys = [...new Set(lines.map((l) => l.accountSystemKey))]
  const { data: accounts } = await admin
    .from('chart_of_accounts')
    .select('id, system_key')
    .eq('tenant_id', tenantId)
    .in('system_key', systemKeys)

  if (!accounts || accounts.length === 0) {
    return fail('coa_not_seeded', 'Chart of accounts not seeded for this tenant', ctx)
  }

  const accountMap = new Map(accounts.map((a) => [a.system_key, a.id]))

  // Verify all required accounts exist
  const missingKeys = systemKeys.filter((k) => !accountMap.has(k))
  if (missingKeys.length > 0) {
    return fail('missing_account', `No account for system_key(s): ${missingKeys.join(', ')}`, ctx)
  }

  // Resolve the party (customer or supplier) named on the entry so the stored
  // narration reads "Party — DocNo — Date — Type" and the reference holds the
  // source document number.
  const partyCustomerId = lines.find((l) => l.customerId)?.customerId
  const partySupplierId = lines.find((l) => l.supplierId)?.supplierId
  const partyEmployeeId = lines.find((l) => l.employeeId)?.employeeId
  const partyOwnerId = lines.find((l) => l.ownerId)?.ownerId
  let partyName: string | null = null
  if (suppressPartyName) {
    partyName = null
  } else if (partyCustomerId) {
    const { data: cust } = await admin
      .from('tajir_customers').select('name').eq('id', partyCustomerId).eq('tenant_id', tenantId).maybeSingle()
    partyName = cust?.name ?? null
  } else if (partySupplierId) {
    const { data: supp } = await admin
      .from('suppliers').select('name').eq('id', partySupplierId).eq('tenant_id', tenantId).maybeSingle()
    partyName = supp?.name ?? null
  } else if (partyEmployeeId) {
    const { data: emp } = await admin
      .from('employees').select('name').eq('id', partyEmployeeId).eq('tenant_id', tenantId).maybeSingle()
    partyName = emp?.name ?? null
  } else if (partyOwnerId) {
    const { data: own } = await admin
      .from('owners').select('name').eq('id', partyOwnerId).eq('tenant_id', tenantId).maybeSingle()
    partyName = own?.name ?? null
  }

  const fullDescription = [partyName, reference, date, description].filter(Boolean).join(' — ')

  // Reuse the caller-supplied voucher (edits) or draw the next one atomically
  let voucherNumber = reuseVoucher ?? null
  if (!voucherNumber) {
    const { data: voucherRow } = await admin
      .rpc('get_next_voucher_number', { p_tenant_id: tenantId, p_prefix: prefix })
    voucherNumber = voucherRow as string | null
  }
  if (!voucherNumber) {
    return fail('no_voucher_number', `Could not allocate a voucher number for prefix ${prefix}`, ctx)
  }

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

  if (entryError || !entry) {
    return fail('header_insert_failed', entryError?.message ?? 'Insert returned no row', ctx)
  }

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
    employee_id:      l.employeeId ?? null,
    owner_id:         l.ownerId ?? null,
  }))

  const { error: linesError } = await admin.from('tajir_journal_entry_lines').insert(lineRows)
  if (linesError) {
    // Roll the header back rather than leaving an entry with no lines, which
    // would show up in the ledger as a zero-value voucher that nothing explains.
    await admin.from('tajir_journal_entries').delete().eq('id', entry.id)
    return fail('lines_insert_failed', linesError.message, ctx)
  }

  return { ok: true, voucherNumber }
}
