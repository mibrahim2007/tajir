'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BUSINESS_ACTIVITIES, SECTORS } from '@/lib/fbr/scenarios'
import {
  saveFbrSettingsAction, saveFbrTokenAction, testFbrConnectionAction, getServerIpAction,
} from '@/app/actions/fbr-settings'

type Initial = {
  enabled: boolean
  sellerNtnCnic: string
  sellerBusinessName: string
  sellerProvince: string
  sellerAddress: string
  businessActivity: string
  sector: string
  furtherTaxRate: number
}

export function FbrSettingsForm({ initial, provinces, tokenLast4, lastTest }: {
  initial: Initial
  provinces: string[]
  tokenLast4: string | null
  lastTest: { ok: boolean; message: string; at: string } | null
}) {
  const router = useRouter()
  const [v, setV] = useState<Initial>(initial)
  const [token, setToken] = useState('')
  const [ip, setIp] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [tokenMsg, setTokenMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => { getServerIpAction().then((r) => r.success && setIp(r.data.ip)) }, [])

  const set = <K extends keyof Initial>(k: K, val: Initial[K]) => { setMsg(null); setV((p) => ({ ...p, [k]: val })) }
  const provinceOptions = v.sellerProvince && !provinces.includes(v.sellerProvince) ? [v.sellerProvince, ...provinces] : provinces

  const save = () => start(async () => {
    const r = await saveFbrSettingsAction(v)
    setMsg(r.success ? { kind: 'ok', text: 'Saved.' } : { kind: 'err', text: r.error })
    if (r.success) router.refresh()
  })
  const saveToken = () => start(async () => {
    const r = await saveFbrTokenAction({ environment: 'sandbox', token })
    setTokenMsg(r.success ? { kind: 'ok', text: `Token saved (…${r.data.last4}).` } : { kind: 'err', text: r.error })
    if (r.success) { setToken(''); router.refresh() }
  })
  const test = () => start(async () => {
    const r = await testFbrConnectionAction()
    if (!r.success) { setTestMsg({ kind: 'err', text: r.error }); return }
    if (r.data.ip) setIp(r.data.ip)
    setTestMsg({ kind: r.data.ok ? 'ok' : 'err', text: r.data.message })
    router.refresh()
  })

  const note = (m: { kind: 'ok' | 'err'; text: string } | null) =>
    m && <p className={`text-sm ${m.kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>{m.text}</p>

  return (
    <div className="space-y-4">
      {/* ── Seller details ── */}
      <div className="bg-card rounded-2xl border shadow-sm px-4 py-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Enable FBR tax invoices</p>
            <p className="text-xs text-muted-foreground">Adds “FBR Tax Invoices” to the Sell menu.</p>
          </div>
          <Switch checked={v.enabled} onCheckedChange={(on) => set('enabled', on)} />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Environment:</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Sandbox</span>
          <span className="text-xs text-muted-foreground">Production opens after the sandbox scenarios pass.</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Seller NTN / CNIC *</Label>
            <Input value={v.sellerNtnCnic} onChange={(e) => set('sellerNtnCnic', e.target.value)} placeholder="7-digit NTN or 13-digit CNIC" inputMode="numeric" className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label>Business name (as registered) *</Label>
            <Input value={v.sellerBusinessName} onChange={(e) => set('sellerBusinessName', e.target.value)} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label>Province *</Label>
            <Select value={v.sellerProvince} onValueChange={(x) => set('sellerProvince', x)}>
              <SelectTrigger className="w-full min-h-[44px]"><SelectValue placeholder="Select province" /></SelectTrigger>
              <SelectContent>{provinceOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Business address *</Label>
            <Input value={v.sellerAddress} onChange={(e) => set('sellerAddress', e.target.value)} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label>Business activity *</Label>
            <Select value={v.businessActivity} onValueChange={(x) => set('businessActivity', x)}>
              <SelectTrigger className="w-full min-h-[44px]"><SelectValue placeholder="As in your sales tax profile" /></SelectTrigger>
              <SelectContent>{BUSINESS_ACTIVITIES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Sector *</Label>
            <Select value={v.sector} onValueChange={(x) => set('sector', x)}>
              <SelectTrigger className="w-full min-h-[44px]"><SelectValue placeholder="As in your sales tax profile" /></SelectTrigger>
              <SelectContent>{SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Further tax on unregistered buyers (%)</Label>
            <Input type="number" step="0.01" min={0} value={v.furtherTaxRate} onChange={(e) => set('furtherTaxRate', Number(e.target.value))} className="min-h-[44px]" />
            <p className="text-xs text-muted-foreground">Added automatically to taxable lines sold to unregistered buyers; can be changed per line.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" className="min-h-[44px]" disabled={pending} onClick={save}>{pending ? 'Saving…' : 'Save settings'}</Button>
          {note(msg)}
        </div>
      </div>

      {/* ── Token + connection ── */}
      <div className="bg-card rounded-2xl border shadow-sm px-4 py-4 space-y-4">
        <div>
          <p className="font-semibold">Sandbox token</p>
          <p className="text-xs text-muted-foreground">
            {tokenLast4 ? <>A token ending <span className="font-mono">…{tokenLast4}</span> is saved. Paste a new one to replace it.</> : 'Issued by PRAL in IRIS → Digital Invoicing.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input type="password" autoComplete="off" value={token} onChange={(e) => { setToken(e.target.value); setTokenMsg(null) }}
            placeholder="Paste sandbox token" className="min-h-[44px] font-mono" />
          <Button type="button" variant="outline" className="min-h-[44px]" disabled={pending || token.trim().length < 20} onClick={saveToken}>Save token</Button>
        </div>
        {note(tokenMsg)}

        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Server IP to whitelist in IRIS: </span>
          <span className="font-mono font-semibold">{ip ?? '…'}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" className="min-h-[44px]" disabled={pending || !tokenLast4} onClick={test}>Test connection</Button>
          {testMsg ? note(testMsg) : lastTest && (
            <p className={`text-sm ${lastTest.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>
              {lastTest.ok ? 'Connected' : 'Failed'} · {lastTest.at} — {lastTest.message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
