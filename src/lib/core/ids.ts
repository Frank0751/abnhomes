/**
 * Identifiers.
 *
 * Ledger entries use UUIDv7 generated on the CLIENT, not the server. A device
 * that is offline must be able to mint an id that will never collide and that
 * still sorts by time when it finally syncs.
 */

import { uuidv7 } from 'uuidv7'

export function newLedgerId(): string {
  return uuidv7()
}

export function newIdempotencyKey(): string {
  return uuidv7()
}

/**
 * Crockford-style alphabet: no I, L, O or U, so a code read down the phone
 * or copied off a receipt cannot be mistyped into a different booking.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function shortCode(length = 6): string {
  const bytes =
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint8Array(length))
      : Uint8Array.from({ length }, () => Math.floor(Math.random() * 256))

  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export const reservationCode = () => `ABN-${shortCode(6)}`
export const ticketCode = () => `TKT-${shortCode(6)}`
export const leaseCode = () => `LSE-${shortCode(6)}`
export const statementCode = () => `STM-${shortCode(6)}`

/** Portal access code, e.g. PIN-8K3M2V. Issued when a booking is confirmed. */
export const portalAccessCode = () => `PIN-${shortCode(6)}`

/** Sequential document numbers, e.g. RCT-2026-000042. Padded so they sort. */
export function sequentialCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`
}

/** Six-digit one-time login code. */
export function otpCode(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1))
  return String(bytes[0] % 1_000_000).padStart(6, '0')
}
