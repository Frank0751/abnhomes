'use server'

import { requestPasswordReset } from '@/lib/password-reset'

export type ForgotResult = { done: true } | { done: false; error: string }

export async function forgotPasswordAction(_prev: ForgotResult | null, formData: FormData): Promise<ForgotResult> {
  const email = String(formData.get('email') ?? '').trim()
  if (!email.includes('@')) return { done: false, error: 'Enter the email address you sign in with.' }

  try {
    await requestPasswordReset(email)
  } catch (error) {
    // Still answer the same way: the form must not reveal who has an account.
    console.error('[forgot-password] failed', error)
  }
  return { done: true }
}
