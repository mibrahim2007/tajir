/*
 * FBR wants a 7-digit NTN or a 13-digit CNIC, digits only. NTNs are commonly
 * written with their check digit ("1866204-8"); the DI API takes the 7-digit
 * base, so the check digit is dropped. CNIC dashes ("35202-1234567-1") are
 * removed.
 */
export function normalizeNtnCnic(raw: string): string {
  const s = raw.trim()
  const withCheck = /^(\d{7})-\d$/.exec(s)
  if (withCheck) return withCheck[1]
  return s.replace(/[-\s]/g, '')
}

export const isNtnOrCnic = (s: string) => /^(\d{7}|\d{13})$/.test(s)
