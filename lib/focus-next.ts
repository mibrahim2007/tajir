/**
 * Move the cursor to the next control after `from`.
 *
 * This is what makes a list-of-values behave the way a data-entry operator
 * expects: choose the item and land on the quantity, choose the customer and
 * land on the date — without reaching for the mouse between every field. The
 * pickers call it after a value is committed.
 *
 * "Next" is document order, which in a line-item table is the next column of
 * the same row, and in a stacked form is the next field down. Nothing here is
 * table-specific, so it holds for both.
 */

const FOCUSABLE = [
  'input:not([type="hidden"]):not([disabled]):not([readonly])',
  'select:not([disabled])',
  'textarea:not([disabled]):not([readonly])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Skips anything not actually on screen — collapsed rows, a closing dialog. */
function isReachable(el: HTMLElement) {
  if (el.hasAttribute('aria-hidden')) return false
  if (el.closest('[aria-hidden="true"]')) return false
  // offsetParent is null for display:none (and for position:fixed, which no
  // field in these forms uses).
  return el.offsetParent !== null
}

export function focusNextControl(from: HTMLElement | null | undefined) {
  if (!from) return

  const all = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => el === from || isReachable(el))

  const next = all[all.indexOf(from) + 1]
  if (!next) return

  // The line-item tables scroll sideways on a phone, so the next column is
  // often off-screen. Bring it into view before focusing, rather than letting
  // the browser jump the page to it.
  next.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  next.focus()

  // Land with the existing value selected so typing replaces it instead of
  // appending to whatever was there.
  if (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) {
    try {
      next.select()
    } catch {
      /* number inputs in some browsers refuse select(); focus alone is fine */
    }
  }
}
