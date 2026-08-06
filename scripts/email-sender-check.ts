// From-address resolution check — run with `npm run check:email-sender`.
//
// Getting this wrong does not throw. The mail is simply refused by Resend with
// "invalid from address", or worse, accepted and delivered as someone the
// sender is not. So the rules are pinned here:
//
//   • an address on a verified sending domain is used as-is
//   • anything else falls back, keeping the human in the display name
//   • a display name can never break out of the mail header
//
// No network and no credentials: resolveFrom is pure apart from two env vars.

import { resolveFrom, isSendableFrom, sendingDomains, FALLBACK_SENDER } from '@/lib/email/sender'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

/** Runs `fn` with env vars applied, then restores them. */
function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = process.env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try { fn() } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

console.log('\n— Default sending domain —')
withEnv({ RESEND_SENDING_DOMAINS: undefined, RESEND_FROM_EMAIL: undefined }, () => {
  check('defaults to jappx.com', sendingDomains().join(',') === 'jappx.com', sendingDomains().join(','))
  check('a jappx.com address is sendable', isSendableFrom('tajirapp@jappx.com'))
  check('a tenant address is NOT sendable', !isSendableFrom('admin@ibrahimshop.com'))
  check('a gmail address is NOT sendable', !isSendableFrom('aamerjamil@gmail.com'))
  check('malformed is not sendable', !isSendableFrom('not-an-email'))
  check('empty is not sendable', !isSendableFrom(''))
  check('null is not sendable', !isSendableFrom(null))
  check('undefined is not sendable', !isSendableFrom(undefined))
})

console.log('\n— The signed-in address is used when it can be —')
withEnv({ RESEND_SENDING_DOMAINS: undefined, RESEND_FROM_EMAIL: undefined }, () => {
  check('used as-is with no name',
    resolveFrom({ userEmail: 'owner@jappx.com' }) === 'owner@jappx.com',
    resolveFrom({ userEmail: 'owner@jappx.com' }))
  check('used with a display name',
    resolveFrom({ userEmail: 'owner@jappx.com', displayName: 'Ibrahim Mobile Shop' }) === '"Ibrahim Mobile Shop" <owner@jappx.com>',
    resolveFrom({ userEmail: 'owner@jappx.com', displayName: 'Ibrahim Mobile Shop' }))
  check('address is lowercased',
    resolveFrom({ userEmail: '  Owner@JAPPX.com ' }) === 'owner@jappx.com',
    resolveFrom({ userEmail: '  Owner@JAPPX.com ' }))
})

console.log('\n— Anything else falls back to tajirapp@jappx.com —')
withEnv({ RESEND_SENDING_DOMAINS: undefined, RESEND_FROM_EMAIL: undefined }, () => {
  const unsendable = ['admin@ibrahimshop.com', 'aamerjamil@gmail.com', 'not-an-email', '', undefined, null]
  for (const value of unsendable) {
    const from = resolveFrom({ userEmail: value as string | undefined })
    check(`"${String(value)}" falls back`, from.includes(FALLBACK_SENDER), from)
  }

  const labelled = resolveFrom({ userEmail: 'admin@ibrahimshop.com', displayName: 'Ibrahim Mobile Shop' })
  check('fallback keeps the sender in the display name',
    labelled === `"Ibrahim Mobile Shop via Tajir" <${FALLBACK_SENDER}>`, labelled)
  check('fallback never claims the unsendable address', !labelled.includes('ibrahimshop.com'), labelled)
})

console.log('\n— Verifying another domain is config, not a deploy —')
withEnv({ RESEND_SENDING_DOMAINS: 'jappx.com, tajir.app', RESEND_FROM_EMAIL: undefined }, () => {
  check('the added domain becomes sendable', isSendableFrom('hello@tajir.app'))
  check('the original still is', isSendableFrom('x@jappx.com'))
  check('an unlisted one still is not', !isSendableFrom('x@example.com'))
  check('used as-is once verified',
    resolveFrom({ userEmail: 'hello@tajir.app' }) === 'hello@tajir.app')
})

console.log('\n— RESEND_FROM_EMAIL overrides the fallback only —')
withEnv({ RESEND_SENDING_DOMAINS: undefined, RESEND_FROM_EMAIL: 'Tajir Support <support@jappx.com>' }, () => {
  check('override used when falling back',
    resolveFrom({ userEmail: 'admin@ibrahimshop.com' }) === 'Tajir Support <support@jappx.com>',
    resolveFrom({ userEmail: 'admin@ibrahimshop.com' }))
  check('override relabelled for a named sender',
    resolveFrom({ userEmail: 'admin@ibrahimshop.com', displayName: 'Makks' }) === '"Makks via Tajir" <support@jappx.com>',
    resolveFrom({ userEmail: 'admin@ibrahimshop.com', displayName: 'Makks' }))
  check('override does NOT beat a sendable user address',
    resolveFrom({ userEmail: 'owner@jappx.com' }) === 'owner@jappx.com',
    resolveFrom({ userEmail: 'owner@jappx.com' }))
  // A blank env var is the classic misconfiguration; it must not win.
  withEnv({ RESEND_FROM_EMAIL: '' }, () => {
    check('a blank override falls through to the built-in',
      resolveFrom({ userEmail: undefined }).includes(FALLBACK_SENDER),
      resolveFrom({ userEmail: undefined }))
  })
})

console.log('\n— A display name cannot inject mail headers —')
withEnv({ RESEND_SENDING_DOMAINS: undefined, RESEND_FROM_EMAIL: undefined }, () => {
  const nasty = 'Evil"\r\nBcc: victim@example.com'
  const from = resolveFrom({ userEmail: 'owner@jappx.com', displayName: nasty })
  // Header injection needs one of two things: a line break to start a header
  // of its own, or a quote to escape the display name. Neither survives — the
  // literal text "Bcc:" left inside the quoted name is inert.
  check('no carriage return survives', !/[\r\n]/.test(from), JSON.stringify(from))
  check('no bare quote survives', from.split('"').length === 3, JSON.stringify(from))
  check('the address itself is untouched', from.endsWith('<owner@jappx.com>'), JSON.stringify(from))

  const long = resolveFrom({ userEmail: 'owner@jappx.com', displayName: 'x'.repeat(300) })
  check('display name is capped', long.length < 120, `${long.length} chars`)
})

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`)
process.exit(failures === 0 ? 0 : 1)
