'use client'

import { useCallback } from 'react'

const FOCUSABLE = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'

export function useEnterToNextField() {
  return useCallback((e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return
    const target = e.target as HTMLElement
    if (target.tagName === 'TEXTAREA') return
    if (target.tagName === 'BUTTON') return

    e.preventDefault()

    const elements = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE))
    const index = elements.indexOf(target)
    if (index > -1 && index < elements.length - 1) {
      elements[index + 1].focus()
    }
  }, [])
}
