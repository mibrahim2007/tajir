'use client'

import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

type BarcodeProps = {
  /** Encoded payload — the item SKU (e.g. "TJR-000123"). */
  value: string
  /** Bar height in px. */
  height?: number
  /** Single module width in px (bar thinness). */
  width?: number
  /** Human-readable text size under the bars. */
  fontSize?: number
  /** Render the human-readable SKU under the bars. */
  displayValue?: boolean
  className?: string
}

/**
 * Renders a Code 128 barcode as inline SVG so it stays crisp at any print DPI.
 * Client-only: JsBarcode mutates a real <svg> node.
 */
export function Barcode({
  value,
  height = 46,
  width = 1.6,
  fontSize = 12,
  displayValue = true,
  className,
}: BarcodeProps) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        height,
        width,
        fontSize,
        displayValue,
        margin: 0,
        textMargin: 2,
        font: 'monospace',
        lineColor: '#000000',
        background: 'transparent',
      })
    } catch {
      // Invalid payload — render nothing rather than crash the label sheet.
    }
  }, [value, height, width, fontSize, displayValue])

  return <svg ref={ref} className={className} role="img" aria-label={`Barcode ${value}`} />
}
