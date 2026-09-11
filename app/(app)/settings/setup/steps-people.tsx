'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UserCog, HandCoins, Handshake, UsersRound, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createOwnerAction } from '@/app/actions/create-owner'
import { createEmployeeAction } from '@/app/actions/create-employee'
import { createAgentAction } from '@/app/actions/create-agent'
import { InviteAssistantForm } from '@/app/settings/team/invite-assistant-form'
import {
  StepHeader, Why, AlreadyHave,
  useDraftRows, SaveRowsButton, DraftGrid, DraftRowShell, Cell, cellInput, enterToNext,
} from './wizard-ui'
import type { SetupData } from './setup-types'

const num = (s: string) => (s.trim() === '' ? 0 : Number(s))
const isNum = (s: string, max = Infinity) =>
  s.trim() === '' || (!Number.isNaN(Number(s)) && Number(s) >= 0 && Number(s) <= max)

/* ── 9. Owners, employees, agents ───────────────────────────────────────── */

type Tab = 'owners' | 'employees' | 'agents'

const TABS: { key: Tab; label: string; icon: React.ElementType; blurb: string }[] = [
  { key: 'owners',    label: 'Owners / Partners', icon: UserCog,   blurb: 'Capital, drawings and profit share' },
  { key: 'employees', label: 'Employees',         icon: HandCoins, blurb: 'Salaries and staff loans' },
  { key: 'agents',    label: 'Agents / Brokers',  icon: Handshake, blurb: 'Commission on trade they bring' },
]

export function PeopleStep({ data }: { data: SetupData }) {
  const [tab, setTab] = useState<Tab>('owners')
  const counts: Record<Tab, number> = { owners: data.counts.owners, employees: data.counts.employees, agents: data.counts.agents }

  return (
    <div>
      <StepHeader
        icon={UserCog}
        title="Owners & Staff"
        description="Optional — the people inside the business whose money moves through the books."
      />
      <Why>
        Skip this if you are a sole trader with no staff. Otherwise: <strong>owners</strong> record capital
        put in and drawings taken out; <strong>employees</strong> get salaries and loans; <strong>agents</strong>{' '}
        (arhti / brokers) earn commission that Tajir accrues automatically on each invoice.
      </Why>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'text-left rounded-xl border px-3 py-2.5 transition-all',
              tab === t.key ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-secondary/60',
            )}
          >
            <div className="flex items-center gap-2">
              <t.icon className={cn('h-4 w-4 shrink-0', tab === t.key ? 'text-primary' : 'text-muted-foreground')} />
              <span className="text-sm font-semibold truncate">{t.label}</span>
              {counts[t.key] > 0 && (
                <span className="ml-auto text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5">{counts[t.key]}</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">{t.blurb}</p>
          </button>
        ))}
      </div>

      {tab === 'owners' && <OwnersGrid data={data} />}
      {tab === 'employees' && <EmployeesGrid data={data} />}
      {tab === 'agents' && <AgentsGrid data={data} />}
    </div>
  )
}

type OwnerDraft = { name: string; phone: string; share: string }
const blankOwner = (): OwnerDraft => ({ name: '', phone: '', share: '' })

function OwnersGrid({ data }: { data: SetupData }) {
  const draft = useDraftRows(blankOwner, 2)
  const shareTotal = data.owners.reduce((s, o) => s + o.sharePct, 0)
  return (
    <>
      <AlreadyHave label="Owners" names={data.owners.map((o) => (o.sharePct ? `${o.name} · ${o.sharePct}%` : o.name))} total={data.counts.owners} href="/owners" />
      {data.counts.owners > 0 && shareTotal !== 100 && (
        <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">Profit shares currently total {shareTotal}% — fine while you are still adding partners.</p>
      )}
      <DraftGrid
        columns={[{ label: 'Owner name', required: true, width: '45%' }, { label: 'Phone', width: '30%' }, { label: 'Profit share %', right: true }]}
        onAdd={draft.add} addLabel="Add another owner" minWidth={560}
      >
        {draft.rows.map((r) => (
          <DraftRowShell key={r._key} error={r._error} onRemove={() => draft.remove(r._key)}>
            <Cell><input className={cellInput} placeholder="e.g. Abdul Rehman" value={r.name} onChange={(e) => draft.update(r._key, { name: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={cellInput} inputMode="tel" placeholder="optional" value={r.phone} onChange={(e) => draft.update(r._key, { phone: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={`${cellInput} text-right tabular-nums`} inputMode="decimal" placeholder="e.g. 50" value={r.share} onChange={(e) => draft.update(r._key, { share: e.target.value })} onKeyDown={enterToNext} /></Cell>
          </DraftRowShell>
        ))}
      </DraftGrid>
      <SaveRowsButton
        label="Save Owners" savedLabel={(n) => `${n} owner${n === 1 ? '' : 's'} saved.`}
        args={{
          rows: draft.rows, setRows: draft.setRows, blank: blankOwner,
          isBlank: (r) => !r.name.trim() && !r.phone.trim() && !r.share.trim(),
          validate: (r) => !r.name.trim() ? 'Name is required' : !isNum(r.share, 100) ? 'Share must be between 0 and 100' : null,
          create: (r) => createOwnerAction({ name: r.name.trim(), phone: r.phone.trim() || undefined, profitSharePct: num(r.share) }),
        }}
      />
    </>
  )
}

type EmployeeDraft = { name: string; designation: string; phone: string; salary: string }
const blankEmployee = (): EmployeeDraft => ({ name: '', designation: '', phone: '', salary: '' })

function EmployeesGrid({ data }: { data: SetupData }) {
  const draft = useDraftRows(blankEmployee, 3)
  return (
    <>
      <AlreadyHave label="Employees" names={data.employees.map((e) => (e.designation ? `${e.name} · ${e.designation}` : e.name))} total={data.counts.employees} href="/employees" />
      <DraftGrid
        columns={[{ label: 'Employee name', required: true, width: '32%' }, { label: 'Designation', width: '24%' }, { label: 'Phone', width: '20%' }, { label: 'Monthly salary (PKR)', right: true }]}
        onAdd={draft.add} addLabel="Add another employee" minWidth={680}
      >
        {draft.rows.map((r) => (
          <DraftRowShell key={r._key} error={r._error} onRemove={() => draft.remove(r._key)}>
            <Cell><input className={cellInput} placeholder="e.g. Muhammad Asif" value={r.name} onChange={(e) => draft.update(r._key, { name: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={cellInput} placeholder="e.g. Munshi, Driver" value={r.designation} onChange={(e) => draft.update(r._key, { designation: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={cellInput} inputMode="tel" placeholder="optional" value={r.phone} onChange={(e) => draft.update(r._key, { phone: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={`${cellInput} text-right tabular-nums`} inputMode="decimal" placeholder="0" value={r.salary} onChange={(e) => draft.update(r._key, { salary: e.target.value })} onKeyDown={enterToNext} /></Cell>
          </DraftRowShell>
        ))}
      </DraftGrid>
      <SaveRowsButton
        label="Save Employees" savedLabel={(n) => `${n} employee${n === 1 ? '' : 's'} saved.`}
        args={{
          rows: draft.rows, setRows: draft.setRows, blank: blankEmployee,
          isBlank: (r) => !r.name.trim() && !r.designation.trim() && !r.phone.trim() && !r.salary.trim(),
          validate: (r) => !r.name.trim() ? 'Name is required' : !isNum(r.salary) ? 'Salary must be a number ≥ 0' : null,
          create: (r) => createEmployeeAction({
            name: r.name.trim(), designation: r.designation.trim() || undefined,
            phone: r.phone.trim() || undefined, monthlySalary: num(r.salary),
          }),
        }}
      />
    </>
  )
}

type AgentDraft = { name: string; phone: string; saleRate: string; purchaseRate: string }
const blankAgent = (): AgentDraft => ({ name: '', phone: '', saleRate: '', purchaseRate: '' })

function AgentsGrid({ data }: { data: SetupData }) {
  const draft = useDraftRows(blankAgent, 2)
  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Rates here are percentages of the invoice value. Per-unit or flat commission can be set from the <Link href="/agents" className="text-primary hover:underline">Agents</Link> page.
      </p>
      <AlreadyHave label="Agents" names={data.agents.map((a) => a.name)} total={data.counts.agents} href="/agents" />
      <DraftGrid
        columns={[{ label: 'Agent name', required: true, width: '36%' }, { label: 'Phone', width: '24%' }, { label: 'Sale commission %', right: true }, { label: 'Purchase commission %', right: true }]}
        onAdd={draft.add} addLabel="Add another agent" minWidth={680}
      >
        {draft.rows.map((r) => (
          <DraftRowShell key={r._key} error={r._error} onRemove={() => draft.remove(r._key)}>
            <Cell><input className={cellInput} placeholder="e.g. Haji Sahib" value={r.name} onChange={(e) => draft.update(r._key, { name: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={cellInput} inputMode="tel" placeholder="optional" value={r.phone} onChange={(e) => draft.update(r._key, { phone: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={`${cellInput} text-right tabular-nums`} inputMode="decimal" placeholder="e.g. 1" value={r.saleRate} onChange={(e) => draft.update(r._key, { saleRate: e.target.value })} onKeyDown={enterToNext} /></Cell>
            <Cell><input className={`${cellInput} text-right tabular-nums`} inputMode="decimal" placeholder="e.g. 0.5" value={r.purchaseRate} onChange={(e) => draft.update(r._key, { purchaseRate: e.target.value })} onKeyDown={enterToNext} /></Cell>
          </DraftRowShell>
        ))}
      </DraftGrid>
      <SaveRowsButton
        label="Save Agents" savedLabel={(n) => `${n} agent${n === 1 ? '' : 's'} saved.`}
        args={{
          rows: draft.rows, setRows: draft.setRows, blank: blankAgent,
          isBlank: (r) => !r.name.trim() && !r.phone.trim() && !r.saleRate.trim() && !r.purchaseRate.trim(),
          validate: (r) =>
            !r.name.trim() ? 'Name is required'
            : !isNum(r.saleRate, 100) || !isNum(r.purchaseRate, 100) ? 'Commission must be between 0 and 100%'
            : null,
          create: (r) => createAgentAction({
            name: r.name.trim(), phone: r.phone.trim() || undefined,
            saleCommissionType: 'percentage', saleCommissionRate: num(r.saleRate),
            purchaseCommissionType: 'percentage', purchaseCommissionRate: num(r.purchaseRate),
          }),
        }}
      />
    </>
  )
}

/* ── 10. Team access ─────────────────────────────────────────────────────── */

export function TeamStep({ data }: { data: SetupData }) {
  const others = Math.max(0, data.counts.team - 1)
  return (
    <div>
      <StepHeader
        icon={UsersRound}
        title="Team Access"
        description="Optional — give your munshi or accountant their own login."
        href="/settings/team"
      />
      <Why>
        Assistants can record sales, purchases, receipts and payments but cannot see Setup, Owners
        or the Audit Log. You choose exactly which modules each assistant sees from the Team page.
        Tajir generates a temporary password; they set their own on first login.
      </Why>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <InviteAssistantForm />
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 self-start">
          <div className="flex items-center gap-3">
            <span className="icon-chip icon-chip-violet h-10 w-10 rounded-xl"><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-bold">{data.counts.team} login{data.counts.team === 1 ? '' : 's'}</p>
              <p className="text-xs text-muted-foreground">{others === 0 ? 'Just you so far' : `You + ${others} team member${others === 1 ? '' : 's'}`}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
            Fine-tune what each person can open — or switch whole modules off for the business — from
            <Link href="/settings/team" className="text-primary hover:underline"> Team</Link> and
            <Link href="/settings/modules" className="text-primary hover:underline"> Modules</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
