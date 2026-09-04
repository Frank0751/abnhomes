/**
 * Phone numbers are identity in Ghana, so matching has to be forgiving.
 * 024 170 4048, 24 170 4048, 233541704048 and +233 54 170 4048 must all
 * resolve to the same person, or the same tenant ends up in the system twice
 * with half their payment history each.
 */

const GHANA_CODE = '233'

/** Ghanaian mobile prefixes, without the trunk zero. */
const GH_MOBILE_PREFIXES = [
  '20', '23', '24', '25', '26', '27', '28', '29',
  '50', '53', '54', '55', '56', '57', '59',
]

/**
 * Normalise to E.164. Ghanaian numbers become +233XXXXXXXXX.
 * Foreign numbers (guests booking from abroad) are kept when already E.164.
 * Returns null when the input cannot be understood.
 */
export function normalisePhone(input: string | null | undefined): string | null {
  if (!input) return null

  const hadPlus = input.trim().startsWith('+')
  const digits = input.replace(/\D/g, '')
  if (!digits) return null

  // Already a full Ghanaian number, with or without the plus.
  if (digits.startsWith(GHANA_CODE) && digits.length === 12) {
    return `+${digits}`
  }

  // A foreign number that arrived in E.164 form. Trust it.
  if (hadPlus && !digits.startsWith(GHANA_CODE)) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  }

  // International access prefix, e.g. 00233...
  if (digits.startsWith('00') && digits.length >= 10) {
    return `+${digits.slice(2)}`
  }

  // Local form with the trunk zero: 0241704048
  if (digits.startsWith('0') && digits.length === 10) {
    return `+${GHANA_CODE}${digits.slice(1)}`
  }

  // Local form without the trunk zero: 241704048
  if (digits.length === 9 && isGhanaMobile(digits)) {
    return `+${GHANA_CODE}${digits}`
  }

  return null
}

function isGhanaMobile(national: string): boolean {
  return GH_MOBILE_PREFIXES.some((p) => national.startsWith(p))
}

export function isValidPhone(input: string | null | undefined): boolean {
  return normalisePhone(input) !== null
}

/** +233541704048 becomes 054 170 4048. Foreign numbers stay in E.164. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return ''
  const digits = e164.replace(/\D/g, '')
  if (digits.startsWith(GHANA_CODE) && digits.length === 12) {
    const n = digits.slice(3)
    return `0${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`
  }
  return e164
}

/**
 * Every form a stored number might have been typed in, so an inbound mobile
 * money payment can be matched to an existing party with
 * `phone: { in: phoneVariants(msisdn) }`.
 */
export function phoneVariants(input: string): string[] {
  const normalised = normalisePhone(input)
  if (!normalised) return [input]

  const digits = normalised.slice(1)
  const variants = new Set<string>([normalised, digits])

  if (digits.startsWith(GHANA_CODE)) {
    const national = digits.slice(3)
    variants.add(national)
    variants.add(`0${national}`)
  }

  return [...variants]
}

/** Ghana Card format: GHA-XXXXXXXXX-X */
export function isValidGhanaCard(value: string | null | undefined): boolean {
  if (!value) return false
  return /^GHA-\d{9}-\d$/i.test(value.trim())
}

export function formatGhanaCard(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (cleaned.startsWith('GHA') && cleaned.length === 13) {
    return `GHA-${cleaned.slice(3, 12)}-${cleaned.slice(12)}`
  }
  return value.toUpperCase()
}

/** Which mobile money network a Ghanaian number belongs to. */
export function detectMomoNetwork(
  phone: string
): 'MOMO_MTN' | 'MOMO_TELECEL' | 'MOMO_AIRTELTIGO' | null {
  const normalised = normalisePhone(phone)
  if (!normalised || !normalised.startsWith(`+${GHANA_CODE}`)) return null
  const prefix = normalised.slice(4, 6)

  if (['24', '25', '53', '54', '55', '59'].includes(prefix)) return 'MOMO_MTN'
  if (['20', '50'].includes(prefix)) return 'MOMO_TELECEL'
  if (['26', '27', '56', '57'].includes(prefix)) return 'MOMO_AIRTELTIGO'
  return null
}
