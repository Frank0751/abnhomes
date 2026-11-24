/**
 * Site-wide policies kept in the Setting table, so the office can change them
 * without a developer and every page reads the same answer.
 */

import { cache } from 'react'
import { db } from '@/lib/db'
import { DEFAULT_CANCELLATION, normalisePolicy, type CancellationPolicy } from '@/lib/core/cancellation'

export const CANCELLATION_KEY = 'cancellation_policy'

/** Read once per request however many components ask. Never throws. */
export const getCancellationPolicy = cache(async (): Promise<CancellationPolicy> => {
  try {
    const row = await db.setting.findUnique({ where: { key: CANCELLATION_KEY } })
    return row ? normalisePolicy(row.value) : DEFAULT_CANCELLATION
  } catch (error) {
    console.error('[policies] could not read the cancellation policy', error)
    return DEFAULT_CANCELLATION
  }
})
