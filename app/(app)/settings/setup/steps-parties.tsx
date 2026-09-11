'use client'

import { Users, Truck, Landmark } from 'lucide-react'
import { createCustomerAction } from '@/app/actions/create-customer'
import { createSupplierAction } from '@/app/actions/create-supplier'
import { createBankAction } from '@/app/actions/create-bank'
import {
  StepHeader, Why, AlreadyHave,
  useDraftRows, SaveRowsButton, DraftGrid, DraftRowShell, Cell, cellInput, enterToNext,
} from './wizard-ui'
import type { SetupData } from './setup-types'

const num = (s: string) => (s.trim() === '' ? 0 : Number(s))
const isMoney = (s: string) => s.trim() === '' || (!Number.isNaN(Number(s)) && Number(s) >= 0)

/* ── 6. Customers ────────────────────────────────────────────────────────── */

type CustomerDraft = { name: string; phone: string; email: string; opening: string }
const blankCustomer = (): CustomerDraft => ({ name: '', phone: '', email: '', opening: '' })

export function CustomersStep({ data }: { data: SetupData }) {
  const draft = useDraftRows(blankCustomer, 4)

  return (
    <div>
      <StepHeader
        icon={Users}
        title="Customers"
        description="The parties you sell to. Add the ones you deal with most; the rest can be created on the fly from a sale."
        href="/customers"
      />
      <Why>
        The phone number powers the WhatsApp share button on invoices, and email lets you send
        statements. <strong>Opening balance</strong> is what the customer already owed you on the day you
        started using Tajir — it becomes the first line of their ledger. Leave it 0 if nothing is outstanding.
      </Why>
      <AlreadyHave label="Customers" names={data.recentCustomers.map((c) => c.name)} total={data.counts.customers} href="/customers" />

      <DraftGrid
        columns={[
          { label: 'Customer name', required: true, width: '32%' },
          { label: 'Phone (WhatsApp)', width: '20%' },
          { label: 'Email', width: '24%' },
          { label: 'Opening receivable (PKR)', right: true },
        ]}
        onAdd={draft.add}
        addLabel="Add another customer"
        minWidth={720}
      >
        {draft.rows.map((r) => (
          <DraftRowShell key={r._key} error={r._error} onRemove={() => draft.remove(r._key)}>
            <Cell><input className={cellInput} placeholder="e.g. Raza Fabrics" value={r.name} onChange={(e) => draft.update(r._key, { name: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={cellInput} inputMode="tel" placeholder="03xx-xxxxxxx" value={r.phone} onChange={(e) => draft.update(r._key, { phone: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={cellInput} inputMode="email" placeholder="optional" value={r.email} onChange={(e) => draft.update(r._key, { email: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={`${cellInput} text-right tabular-nums`} inputMode="decimal" placeholder="0" value={r.opening} onChange={(e) => draft.update(r._key, { opening: e.target.value })} onKeyDown={enterToNext} /></Cell>
          </DraftRowShell>
        ))}
      </DraftGrid>

      <SaveRowsButton
        label="Save Customers"
        savedLabel={(n) => `${n} customer${n === 1 ? '' : 's'} saved.`}
        args={{
          rows: draft.rows, setRows: draft.setRows, blank: blankCustomer,
          isBlank: (r) => !r.name.trim() && !r.phone.trim() && !r.email.trim() && !r.opening.trim(),
          validate: (r) => !r.name.trim() ? 'Name is required' : !isMoney(r.opening) ? 'Opening balance must be a number ≥ 0' : null,
          create: (r) => createCustomerAction({
            name: r.name.trim(),
            phone: r.phone.trim() || undefined,
            email: r.email.trim() || undefined,
            openingBalance: num(r.opening),
            openingBalanceCurrency: 'PKR',
            exchangeRate: 1,
          }),
        }}
      />
    </div>
  )
}

/* ── 7. Suppliers ────────────────────────────────────────────────────────── */

type SupplierDraft = { name: string; email: string; opening: string }
const blankSupplier = (): SupplierDraft => ({ name: '', email: '', opening: '' })

export function SuppliersStep({ data }: { data: SetupData }) {
  const draft = useDraftRows(blankSupplier, 4)

  return (
    <div>
      <StepHeader
        icon={Truck}
        title="Suppliers"
        description="The mills, traders and vendors you buy from."
        href="/suppliers"
      />
      <Why>
        <strong>Opening payable</strong> is what you already owed the supplier when you started —
        it seeds their ledger and the Payables Aging report. If the same party is both a customer and a
        supplier, add them in both places; you can link the two ledgers later from their profile.
      </Why>
      <AlreadyHave label="Suppliers" names={data.recentSuppliers.map((s) => s.name)} total={data.counts.suppliers} href="/suppliers" />

      <DraftGrid
        columns={[
          { label: 'Supplier name', required: true, width: '40%' },
          { label: 'Email', width: '30%' },
          { label: 'Opening payable (PKR)', right: true },
        ]}
        onAdd={draft.add}
        addLabel="Add another supplier"
        minWidth={600}
      >
        {draft.rows.map((r) => (
          <DraftRowShell key={r._key} error={r._error} onRemove={() => draft.remove(r._key)}>
            <Cell><input className={cellInput} placeholder="e.g. Ali Spinning Mills" value={r.name} onChange={(e) => draft.update(r._key, { name: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={cellInput} inputMode="email" placeholder="optional" value={r.email} onChange={(e) => draft.update(r._key, { email: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={`${cellInput} text-right tabular-nums`} inputMode="decimal" placeholder="0" value={r.opening} onChange={(e) => draft.update(r._key, { opening: e.target.value })} onKeyDown={enterToNext} /></Cell>
          </DraftRowShell>
        ))}
      </DraftGrid>

      <SaveRowsButton
        label="Save Suppliers"
        savedLabel={(n) => `${n} supplier${n === 1 ? '' : 's'} saved.`}
        args={{
          rows: draft.rows, setRows: draft.setRows, blank: blankSupplier,
          isBlank: (r) => !r.name.trim() && !r.email.trim() && !r.opening.trim(),
          validate: (r) => !r.name.trim() ? 'Name is required' : !isMoney(r.opening) ? 'Opening balance must be a number ≥ 0' : null,
          create: (r) => createSupplierAction({
            name: r.name.trim(),
            email: r.email.trim() || undefined,
            openingBalance: num(r.opening),
            openingBalanceCurrency: 'PKR',
            exchangeRate: 1,
          }),
        }}
      />
    </div>
  )
}

/* ── 8. Banks ────────────────────────────────────────────────────────────── */

type BankDraft = { name: string; accountNumber: string; branch: string; opening: string }
const blankBank = (): BankDraft => ({ name: '', accountNumber: '', branch: '', opening: '' })

export function BanksStep({ data }: { data: SetupData }) {
  const draft = useDraftRows(blankBank, 2)

  return (
    <div>
      <StepHeader
        icon={Landmark}
        title="Bank Accounts"
        description="Every account you receive into or pay from — needed for cheques and online transfers."
        href="/banks"
      />
      <Why>
        Receipts and payments ask which bank a cheque or transfer went through, and the Bank
        Statement and Cheque Register are per account. <strong>Opening balance</strong> is the
        balance in the account on your start date. Cash in hand is set on the Accounts page, not here.
      </Why>
      <AlreadyHave
        label="Banks"
        names={data.banks.map((b) => (b.accountNumber ? `${b.name} · ${b.accountNumber}` : b.name))}
        total={data.counts.banks}
        href="/banks"
      />

      <DraftGrid
        columns={[
          { label: 'Bank', required: true, width: '24%' },
          { label: 'Account number', width: '28%' },
          { label: 'Branch', width: '24%' },
          { label: 'Opening balance (PKR)', right: true },
        ]}
        onAdd={draft.add}
        addLabel="Add another bank account"
        minWidth={700}
      >
        {draft.rows.map((r) => (
          <DraftRowShell key={r._key} error={r._error} onRemove={() => draft.remove(r._key)}>
            <Cell><input className={cellInput} placeholder="e.g. HBL" value={r.name} onChange={(e) => draft.update(r._key, { name: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={`${cellInput} font-mono`} placeholder="0123-4567890-01" value={r.accountNumber} onChange={(e) => draft.update(r._key, { accountNumber: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={cellInput} placeholder="e.g. Faisalabad Main" value={r.branch} onChange={(e) => draft.update(r._key, { branch: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={`${cellInput} text-right tabular-nums`} inputMode="decimal" placeholder="0" value={r.opening} onChange={(e) => draft.update(r._key, { opening: e.target.value })} onKeyDown={enterToNext} /></Cell>
          </DraftRowShell>
        ))}
      </DraftGrid>

      <SaveRowsButton
        label="Save Banks"
        savedLabel={(n) => `${n} bank account${n === 1 ? '' : 's'} saved.`}
        args={{
          rows: draft.rows, setRows: draft.setRows, blank: blankBank,
          isBlank: (r) => !r.name.trim() && !r.accountNumber.trim() && !r.branch.trim() && !r.opening.trim(),
          validate: (r) => !r.name.trim() ? 'Bank name is required' : !isMoney(r.opening) ? 'Opening balance must be a number ≥ 0' : null,
          create: (r) => createBankAction({
            name: r.name.trim(),
            accountNumber: r.accountNumber.trim() || undefined,
            branch: r.branch.trim() || undefined,
            openingBalance: num(r.opening),
          }),
        }}
      />
    </div>
  )
}
