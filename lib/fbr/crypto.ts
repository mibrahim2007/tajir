import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/*
 * PRAL bearer tokens are taxpayer credentials valid for five years, so they are
 * stored encrypted (AES-256-GCM). The key lives only in the server env
 * (FBR_TOKEN_KEY, 32 random bytes, base64) — a database dump alone cannot be
 * used to post invoices in a tenant's name.
 *
 * Stored form: v1:<iv b64>:<tag b64>:<ciphertext b64>
 */

function key(): Buffer {
  const raw = process.env.FBR_TOKEN_KEY
  if (!raw) throw new Error('FBR_TOKEN_KEY is not configured on the server')
  const k = Buffer.from(raw, 'base64')
  if (k.length !== 32) throw new Error('FBR_TOKEN_KEY must be 32 bytes (base64)')
  return k
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':')
}

export function decryptToken(stored: string): string {
  const [v, iv, tag, enc] = stored.split(':')
  if (v !== 'v1' || !iv || !tag || !enc) throw new Error('Unrecognised token format')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(enc, 'base64')), decipher.final()]).toString('utf8')
}

export const tokenKeyConfigured = () => !!process.env.FBR_TOKEN_KEY
