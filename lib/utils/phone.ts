/**
 * Normalises a user-entered phone number to the digits-only international
 * form wa.me expects (no '+', spaces, or leading zero). Best-effort for
 * Pakistani numbers, which customers enter in many shapes:
 *
 *   0300 1234567   -> 923001234567
 *   0300-1234567   -> 923001234567
 *   +92 300 1234567 -> 923001234567
 *   92 300 1234567 -> 923001234567
 *   300 1234567    -> 923001234567
 *
 * Returns null when there aren't enough digits to be a real number.
 */
export function toWaNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (!digits) return null

  // Strip international prefixes / leading zeros down to the national number.
  if (digits.startsWith('0092')) digits = digits.slice(4)
  else if (digits.startsWith('92')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = digits.replace(/^0+/, '')

  // Pakistani mobile national numbers are 10 digits (3XXXXXXXXX).
  if (digits.length < 9) return null

  return `92${digits}`
}
