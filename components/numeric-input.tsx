'use client'

import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Input } from '@/components/ui/input'

type Props = Omit<ComponentPropsWithoutRef<typeof Input>, 'type'>

export const NumericInput = forwardRef<HTMLInputElement, Props>(
  ({ onFocus, ...props }, ref) => (
    <Input
      ref={ref}
      type="number"
      onFocus={(e) => {
        e.target.select()
        onFocus?.(e)
      }}
      {...props}
    />
  ),
)
NumericInput.displayName = 'NumericInput'
