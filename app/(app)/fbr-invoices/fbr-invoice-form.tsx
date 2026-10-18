'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ItemPickerDialog } from '@/components/item-picker-dialog'
import { formatPKR } from '@/lib/utils/currency'
import { lineTotals, invoiceTotals, type FbrLineInput } from '@/lib/fbr/calc'
import { SCENARIOS, ALWAYS_OFFERED, scenarioById, defaultScenario, RATE_SUGGESTIONS, type BuyerType } from '@/lib/fbr/scenarios'
import { saveFbrInvoiceAction, checkBuyerRegistrationAction } from '@/app/actions/fbr-invoices'

export type FbrBuyerPreset = {
  id: string
  name: string
  /** Details from this customer's most recent FBR invoice, if any. */
  last?: { type: BuyerType; ntn: string; province: string; address: string }
}

export type FbrInvoiceFormValues = {
  id?: string
  invoiceType: 'Sale Invoice' | 'Debit Note'
  invoiceDate: string
  buyerRegistrationType: BuyerType
  buyerNtnCnic: string
  buyerBusinessName: string
  buyerProvince: string
  buyerAddress: string
  customerId: string | null
  invoiceRefNo: string
  scenarioId: string
  lines: FbrLineInput[]
}

const blankLine = (rate = '18%'): FbrLineInput => ({
  hsCode: '', productDescription: '', uom: 'KG', quantity: 1, unitPrice: 0, discount: 0, rate, retailPrice: 0,
  extraTax: 0, fedPayable: 0, salesTaxWithheldAtSource: 0, furtherTaxOverride: null, sroScheduleNo: '', sroItemSerialNo: '',
})

export function FbrInvoiceForm({ initial, today, customers, provinces, uoms, applicable, furtherTaxRate }: {
  initial?: FbrInvoiceFormValues
  today: string
  customers: FbrBuyerPreset[]
  provinces: string[]
  uoms: string[]
  applicable: string[]
  furtherTaxRate: number
}) {
  const router = useRouter()
  const [v, setV] = useState<FbrInvoiceFormValues>(initial ?? {
    invoiceType: 'Sale Invoice',
    invoiceDate: today,
    buyerRegistrationType: 'Registered',
    buyerNtnCnic: '', buyerBusinessName: '', buyerProvince: '', buyerAddress: '',
    customerId: null, invoiceRefNo: '',
    scenarioId: defaultScenario('Registered'),
    lines: [blankLine()],
  })
  const [showAll, setShowAll] = useState(false)
  const [advanced, setAdvanced] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [regCheck, setRegCheck] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const set = <K extends keyof FbrInvoiceFormValues>(k: K, val: FbrInvoiceFormValues[K]) => { setError(null); setV((p) => ({ ...p, [k]: val })) }
  const setLine = (i: number, patch: Partial<FbrLineInput>) =>
    setV((p) => ({ ...p, lines: p.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))

  const scenario = scenarioById(v.scenarioId)
  const buyer = v.buyerRegistrationType

  // Scenarios offered: standard-rate registered / unregistered plus the
  // tenant's applicable ones, limited to those that fit this buyer type.
  const scenarioOptions = useMemo(() => {
    const pool = showAll || applicable.length === 0 ? SCENARIOS : SCENARIOS.filter((s) => applicable.includes(s.id) || ALWAYS_OFFERED.includes(s.id))
    return pool.filter((s) => !s.buyer || s.buyer === buyer || s.id === v.scenarioId)
  }, [showAll, applicable, buyer, v.scenarioId])

  const computed = v.lines.map((l) => lineTotals(l, { buyer, furtherTaxRate, retailPrice: !!scenario?.retailPrice }))
  const totals = invoiceTotals(computed)

  const chooseBuyerType = (t: BuyerType) => {
    setRegCheck(null)
    setV((p) => {
      const sc = scenarioById(p.scenarioId)
      const keep = sc && (!sc.buyer || sc.buyer === t)
      return { ...p, buyerRegistrationType: t, scenarioId: keep ? p.scenarioId : defaultScenario(t) }
    })
  }

  const chooseScenario = (id: string) => {
    const sc = scenarioById(id)
    setV((p) => ({
      ...p,
      scenarioId: id,
      // Carry the scenario's usual rate onto lines still on the previous default.
      lines: sc?.defaultRate ? p.lines.map((l) => (l.rate === scenarioById(p.scenarioId)?.defaultRate || !l.rate ? { ...l, rate: sc.defaultRate } : l)) : p.lines,
    }))
  }

  const pickCustomer = (id: string) => {
    const c = customers.find((x) => x.id === id)
    if (!c) return
    setRegCheck(null)
    setV((p) => ({
      ...p,
      customerId: id,
      buyerBusinessName: c.name,
      ...(c.last ? {
        buyerRegistrationType: c.last.type,
        buyerNtnCnic: c.last.ntn,
        buyerProvince: c.last.province,
        buyerAddress: c.last.address,
        scenarioId: scenarioById(p.scenarioId)?.buyer && scenarioById(p.scenarioId)?.buyer !== c.last.type
          ? defaultScenario(c.last.type) : p.scenarioId,
      } : {}),
    }))
  }

  const verifyBuyer = () => start(async () => {
    setRegCheck(null)
    const r = await checkBuyerRegistrationAction(v.buyerNtnCnic)
    if (!r.success) { setRegCheck(r.error); return }
    setRegCheck(r.data.registrationType && r.data.registrationType !== buyer
      ? `${r.data.message} — this buyer should be invoiced as ${r.data.registrationType}.`
      : r.data.message)
  })

  const save = () => start(async () => {
    setError(null)
    const r = await saveFbrInvoiceAction({ ...v, customerId: v.customerId || null })
    if (!r.success) { setError(r.error); return }
    router.push(`/fbr-invoices/${r.data.id}`)
    router.refresh()
  })

  const provinceOptions = v.buyerProvince && !provinces.includes(v.buyerProvince) ? [v.buyerProvince, ...provinces] : provinces
  const num = (s: string) => (s === '' ? 0 : Number(s))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-4 items-start">
      <div className="space-y-4 min-w-0">
        {/* ── Buyer type: the user's choice ── */}
        <div className="bg-card rounded-2xl border shadow-sm px-4 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Invoice to</p>
          <div className="grid grid-cols-2 gap-3">
            {(['Registered', 'Unregistered'] as const).map((t) => (
              <button key={t} type="button" onClick={() => chooseBuyerType(t)}
                className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  buyer === t ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                <p className="font-semibold">{t} buyer</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t === 'Registered' ? 'Sales-tax registered — NTN/CNIC required' : `Not registered — further tax ${furtherTaxRate}% applies`}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Invoice + buyer details ── */}
        <div className="bg-card rounded-2xl border shadow-sm px-4 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Document</Label>
              <Select value={v.invoiceType} onValueChange={(x) => set('invoiceType', x as FbrInvoiceFormValues['invoiceType'])}>
                <SelectTrigger className="w-full min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sale Invoice">Sale Invoice</SelectItem>
                  <SelectItem value="Debit Note">Debit Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" max={today} value={v.invoiceDate} onChange={(e) => set('invoiceDate', e.target.value)} className="min-h-[44px]" />
            </div>
            <div className="space-y-1">
              <Label>Customer (optional)</Label>
              <ItemPickerDialog items={customers.map((c) => ({ id: c.id, name: c.name, badge: c.last?.type }))}
                value={v.customerId ?? ''} onSelect={pickCustomer} placeholder="Fill from customer…" title="Select Customer" />
            </div>
          </div>

          {v.invoiceType === 'Debit Note' && (
            <div className="space-y-1">
              <Label>Original FBR invoice number *</Label>
              <Input value={v.invoiceRefNo} onChange={(e) => set('invoiceRefNo', e.target.value.trim())} placeholder="e.g. 7000007DI1747119701593" className="min-h-[44px] font-mono" />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Buyer name *</Label>
              <Input value={v.buyerBusinessName} onChange={(e) => set('buyerBusinessName', e.target.value)} className="min-h-[44px]" />
            </div>
            <div className="space-y-1">
              <Label>Buyer NTN / CNIC {buyer === 'Registered' ? '*' : '(optional)'}</Label>
              <div className="flex gap-2">
                <Input value={v.buyerNtnCnic} onChange={(e) => { set('buyerNtnCnic', e.target.value); setRegCheck(null) }}
                  placeholder="7 or 13 digits" inputMode="numeric" className="min-h-[44px]" />
                <Button type="button" variant="outline" className="min-h-[44px] shrink-0" disabled={pending || !v.buyerNtnCnic} onClick={verifyBuyer}>Check FBR</Button>
              </div>
              {regCheck && <p className="text-xs text-muted-foreground">{regCheck}</p>}
            </div>
            <div className="space-y-1">
              <Label>Buyer province *</Label>
              <Select value={v.buyerProvince} onValueChange={(x) => set('buyerProvince', x)}>
                <SelectTrigger className="w-full min-h-[44px]"><SelectValue placeholder="Select province" /></SelectTrigger>
                <SelectContent>{provinceOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Buyer address *</Label>
              <Input value={v.buyerAddress} onChange={(e) => set('buyerAddress', e.target.value)} className="min-h-[44px]" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Scenario (sandbox)</Label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show all
              </label>
            </div>
            <Select value={v.scenarioId} onValueChange={chooseScenario}>
              <SelectTrigger className="w-full min-h-[44px] [&>span]:truncate"><SelectValue /></SelectTrigger>
              <SelectContent>
                {scenarioOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.id} · {s.description}</SelectItem>)}
              </SelectContent>
            </Select>
            {scenario && <p className="text-xs text-muted-foreground">Sale type sent to FBR: {scenario.saleType}</p>}
          </div>
        </div>

        {/* ── Lines ── */}
        <datalist id="fbr-uoms">{uoms.map((u) => <option key={u} value={u} />)}</datalist>
        <datalist id="fbr-rates">{RATE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}</datalist>
        {v.lines.map((l, i) => {
          const t = computed[i]
          return (
            <div key={i} className="bg-card rounded-2xl border shadow-sm px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Line {i + 1}</p>
                {v.lines.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setV((p) => ({ ...p, lines: p.lines.filter((_, j) => j !== i) }))}>Remove</Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                <div className="space-y-1 col-span-1 sm:col-span-1">
                  <Label className="text-xs">HS code *</Label>
                  <Input value={l.hsCode} onChange={(e) => setLine(i, { hsCode: e.target.value.trim() })} placeholder="5205.1200" className="min-h-[44px] font-mono" />
                </div>
                <div className="space-y-1 col-span-1 sm:col-span-3">
                  <Label className="text-xs">Product description *</Label>
                  <Input value={l.productDescription} onChange={(e) => setLine(i, { productDescription: e.target.value })} className="min-h-[44px]" />
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-2">
                  <Label className="text-xs">Unit *</Label>
                  <Input list="fbr-uoms" value={l.uom} onChange={(e) => setLine(i, { uom: e.target.value })} className="min-h-[44px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantity *</Label>
                  <Input type="number" step="0.0001" min={0} value={l.quantity || ''} onChange={(e) => setLine(i, { quantity: num(e.target.value) })} className="min-h-[44px] text-right" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unit price (excl. tax)</Label>
                  <Input type="number" step="0.01" min={0} value={l.unitPrice || ''} onChange={(e) => setLine(i, { unitPrice: num(e.target.value) })} className="min-h-[44px] text-right" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Discount</Label>
                  <Input type="number" step="0.01" min={0} value={l.discount || ''} onChange={(e) => setLine(i, { discount: num(e.target.value) })} className="min-h-[44px] text-right" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tax rate *</Label>
                  <Input list="fbr-rates" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} placeholder="18%" className="min-h-[44px]" />
                </div>
                {scenario?.retailPrice && (
                  <div className="space-y-1">
                    <Label className="text-xs">Retail price / unit *</Label>
                    <Input type="number" step="0.01" min={0} value={l.retailPrice || ''} onChange={(e) => setLine(i, { retailPrice: num(e.target.value) })} className="min-h-[44px] text-right" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Further tax {l.furtherTaxOverride === null ? '(auto)' : ''}</Label>
                  <div className="flex gap-1">
                    <Input type="number" step="0.01" min={0} value={l.furtherTaxOverride ?? t.furtherTax}
                      onChange={(e) => setLine(i, { furtherTaxOverride: e.target.value === '' ? null : num(e.target.value) })} className="min-h-[44px] text-right" />
                    {l.furtherTaxOverride !== null && (
                      <Button type="button" variant="ghost" size="sm" className="min-h-[44px] px-2" onClick={() => setLine(i, { furtherTaxOverride: null })}>auto</Button>
                    )}
                  </div>
                </div>
              </div>

              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setAdvanced((a) => ({ ...a, [i]: !a[i] }))}>
                {advanced[i] ? 'Hide' : 'More fields'} — extra tax, FED, ST withheld, SRO
              </button>
              {advanced[i] && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {([
                    ['extraTax', 'Extra tax'], ['fedPayable', 'FED payable'], ['salesTaxWithheldAtSource', 'ST withheld at source'],
                  ] as const).map(([k, label]) => (
                    <div key={k} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input type="number" step="0.01" min={0} value={l[k] || ''} onChange={(e) => setLine(i, { [k]: num(e.target.value) })} className="min-h-[44px] text-right" />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label className="text-xs">SRO schedule no</Label>
                    <Input value={l.sroScheduleNo} onChange={(e) => setLine(i, { sroScheduleNo: e.target.value })} className="min-h-[44px]" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">SRO item serial no</Label>
                    <Input value={l.sroItemSerialNo} onChange={(e) => setLine(i, { sroItemSerialNo: e.target.value })} className="min-h-[44px]" />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-x-5 gap-y-1 text-xs text-muted-foreground border-t pt-2">
                <span>Value excl. ST <b className="text-foreground tabular-nums">{formatPKR(t.valueSalesExcludingST)}</b></span>
                <span>Sales tax <b className="text-foreground tabular-nums">{formatPKR(t.salesTaxApplicable)}</b></span>
                {t.furtherTax > 0 && <span>Further tax <b className="text-foreground tabular-nums">{formatPKR(t.furtherTax)}</b></span>}
                <span>Line total <b className="text-foreground tabular-nums">{formatPKR(t.totalValues)}</b></span>
              </div>
            </div>
          )
        })}
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setV((p) => ({ ...p, lines: [...p.lines, blankLine(scenario?.defaultRate || '')] }))}>
          + Add line
        </Button>
      </div>

      {/* ── Summary ── */}
      <div className="bg-card rounded-2xl border shadow-sm px-4 py-4 space-y-2 lg:sticky lg:top-4">
        <p className="font-semibold">{v.invoiceType}</p>
        <p className="text-xs text-muted-foreground">{buyer} buyer · {v.scenarioId}</p>
        <div className="space-y-1 text-sm pt-2">
          <div className="flex justify-between"><span className="text-muted-foreground">Value excl. sales tax</span><span className="tabular-nums">{formatPKR(totals.value)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Sales tax</span><span className="tabular-nums">{formatPKR(totals.salesTax)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Further tax</span><span className="tabular-nums">{formatPKR(totals.furtherTax)}</span></div>
          <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span className="tabular-nums">{formatPKR(totals.total)}</span></div>
        </div>
        {error && <p className="text-sm text-destructive pt-1">{error}</p>}
        <Button type="button" className="w-full min-h-[44px] mt-2" disabled={pending} onClick={save}>
          {pending ? 'Saving…' : 'Save invoice'}
        </Button>
        <p className="text-xs text-muted-foreground">Saved as a draft. Validate and post it to FBR on the next screen.</p>
      </div>
    </div>
  )
}
