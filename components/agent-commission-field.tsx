'use client'

import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatPKR } from '@/lib/utils/currency'
import {
  COMMISSION_TYPES,
  computeCommission,
  formatCommissionRate,
  type CommissionSide,
  type CommissionType,
} from '@/lib/agents/commission'

export type AgentOption = {
  id: string
  name: string
  saleCommissionType: CommissionType
  saleCommissionRate: number
  purchaseCommissionType: CommissionType
  purchaseCommissionRate: number
}

/** Form fields this component owns on the surrounding invoice form. */
export type AgentCommissionFormValues = {
  agentId: string
  agentCommissionType: CommissionType | ''
  agentCommissionRate: number | null
}

const NONE = '__none__'

/**
 * Agent picker for an invoice, with the commission it will accrue shown live.
 *
 * The agent's enrolled terms apply by default; "Use a different rate for this
 * invoice" reveals an override that is stored on the accrual WITHOUT touching
 * the agent's standing terms — a one-off deal is common and should not force a
 * trip to the Agents page and back.
 *
 * The preview runs the same `computeCommission` the server does, so what the
 * user reads here is exactly what posts.
 */
export function AgentCommissionField({
  agents,
  side,
  baseAmount,
  baseQuantity,
}: {
  agents: AgentOption[]
  side: CommissionSide
  /** Invoice value in PKR, as it currently stands on the form. */
  baseAmount: number
  /** Total invoice quantity, for a per-unit rate. */
  baseQuantity: number
}) {
  const { control, watch, setValue, getValues } = useFormContext<AgentCommissionFormValues>()
  // Open in override mode when the form already carries one — editing an invoice
  // prefills the rate that was actually posted, and the preview must show that
  // rate rather than the agent's current terms.
  const [overriding, setOverriding] = useState(() => !!getValues('agentCommissionType'))

  const agentId = watch('agentId')
  const overrideType = watch('agentCommissionType')
  const overrideRate = watch('agentCommissionRate')

  const agent = agents.find((a) => a.id === agentId)
  const defaultType = agent
    ? (side === 'sale' ? agent.saleCommissionType : agent.purchaseCommissionType)
    : 'none'
  const defaultRate = agent
    ? (side === 'sale' ? agent.saleCommissionRate : agent.purchaseCommissionRate)
    : 0

  const effectiveType = (overriding && overrideType ? overrideType : defaultType) as CommissionType
  const effectiveRate = overriding && overrideRate !== null && overrideRate !== undefined
    ? Number(overrideRate)
    : defaultRate

  const commission = computeCommission({
    type: effectiveType, rate: effectiveRate, baseAmount, baseQuantity,
  })

  const clearOverride = () => {
    setOverriding(false)
    setValue('agentCommissionType', '')
    setValue('agentCommissionRate', null)
  }

  if (agents.length === 0) return null

  return (
    <div className="space-y-3">
      <FormField control={control} name="agentId" render={({ field }) => (
        <FormItem>
          <FormLabel>Agent / Broker (optional)</FormLabel>
          <Select
            value={field.value || NONE}
            onValueChange={(v) => {
              field.onChange(v === NONE ? '' : v)
              // A rate typed for one agent must not silently follow to another.
              clearOverride()
            }}
          >
            <FormControl>
              <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="No agent" /></SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value={NONE}>No agent</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                  {' — '}
                  {formatCommissionRate(
                    side === 'sale' ? a.saleCommissionType : a.purchaseCommissionType,
                    side === 'sale' ? a.saleCommissionRate : a.purchaseCommissionRate,
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />

      {agent && (
        <div className="rounded-lg border bg-muted/30 px-3 py-2 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm tabular-nums">
              <span className="text-muted-foreground">Commission </span>
              <span className="font-medium">{formatCommissionRate(effectiveType, effectiveRate)}</span>
              {commission > 0 && (
                <>
                  <span className="text-muted-foreground"> · </span>
                  <span className="font-semibold">{formatPKR(commission)}</span>
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => (overriding ? clearOverride() : setOverriding(true))}
              className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
            >
              {overriding ? 'Use enrolled rate' : 'Use a different rate for this invoice'}
            </button>
          </div>

          {overriding && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <FormField control={control} name="agentCommissionType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Type</FormLabel>
                  <Select value={field.value || defaultType} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="min-h-[40px]"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {COMMISSION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {effectiveType !== 'none' && (
                <FormField control={control} name="agentCommissionRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      Rate <span className="text-muted-foreground font-normal">
                        ({COMMISSION_TYPES.find((t) => t.value === effectiveType)?.unit})
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number" step="0.0001" min="0" className="min-h-[40px]"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(Number.isNaN(e.target.valueAsNumber) ? null : e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>
          )}

          {commission > 0 && (
            <p className="text-xs text-muted-foreground">
              Posts Dr Commission Expense (6500) · Cr Agent Commission Payable (2150).
              {side === 'purchase' && ' Stock value is unaffected.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
