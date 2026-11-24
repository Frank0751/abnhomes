import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, LegalSection } from '@/components/site/legal-page'
import { getCancellationPolicy } from '@/lib/policies'
import { cancellationDates, cancellationSummary, hasPartialTier } from '@/lib/core/cancellation'
import { addDays, formatDate, today } from '@/lib/core/dates'

// Built ahead of time and refreshed hourly: cheap to serve, and the policy
// from Settings (and the example dates) never go stale for long.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Cancellation policy',
  description: 'When you can cancel an ABN Homes stay, what is refunded, and how long a refund takes.',
  alternates: { canonical: '/cancellation-policy' },
}

export default async function CancellationPolicyPage() {
  const policy = await getCancellationPolicy()
  const partial = hasPartialTier(policy)

  // A worked example beats a rule: a stay arriving four weeks from today.
  const arrival = addDays(today(), 28)
  const example = cancellationDates(policy, arrival)

  return (
    <LegalPage title="Cancellation policy" intro={cancellationSummary(policy)} updated="24 November 2026">
      <LegalSection title="The short version">
        <ul>
          <li>
            <strong>Full refund</strong> if you cancel{' '}
            {policy.fullRefundDays === 0
              ? 'any time before the day you arrive'
              : `${policy.fullRefundDays} or more days before the day you arrive`}
            .
          </li>
          {partial && (
            <li>
              <strong>{policy.partialPercent}% refund</strong> if you cancel after that but{' '}
              {policy.partialRefundDays === 0
                ? 'before the day you arrive'
                : `${policy.partialRefundDays} or more days before you arrive`}
              .
            </li>
          )}
          <li>
            <strong>No refund</strong> after that, or if you do not arrive.
          </li>
        </ul>
        <p>
          Days are counted in whole calendar days before your check-in date, in Ghana time (GMT). The exact dates for
          your stay are shown on the room page and at checkout before you pay.
        </p>
      </LegalSection>

      <LegalSection title="An example">
        <p>
          For a stay arriving on <strong>{formatDate(arrival)}</strong>: cancel on or before{' '}
          <strong>{formatDate(example.fullUntil)}</strong> for a full refund
          {example.partialUntil && (
            <>
              , or on or before <strong>{formatDate(example.partialUntil)}</strong> for {policy.partialPercent}% back
            </>
          )}
          . After that the booking is non-refundable.
        </p>
      </LegalSection>

      <LegalSection title="How to cancel">
        <ul>
          <li>
            Sign in to{' '}
            <Link href="/portal" className="underline underline-offset-2">
              your guest portal
            </Link>{' '}
            with the code from your confirmation message, open the booking and choose “Cancel booking”. You will see
            what is refunded before you confirm.
          </li>
          <li>Or call or WhatsApp us on 054 170 4048 with your booking reference.</li>
        </ul>
        <p>The time that counts is when you cancel in the portal or when your message reaches us.</p>
      </LegalSection>

      <LegalSection title="Refunds">
        <ul>
          <li>Refunds go back to the card or Mobile Money wallet you paid with.</li>
          <li>
            We start a refund within 2 working days. Your bank or network can take 5 to 10 working days to show it.
          </li>
          <li>The refund is a share of what you actually paid for the stay, including extras you have not used.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Unpaid booking requests">
        <p>
          A booking request that has not been paid holds the dates for 48 hours and is then released automatically.
          Nothing is charged and there is nothing to cancel.
        </p>
      </LegalSection>

      <LegalSection title="Changing dates, leaving early">
        <ul>
          <li>
            Want different dates? While your booking is still fully refundable you can move it yourself in{' '}
            <Link href="/portal" className="underline underline-offset-2">
              your guest portal
            </Link>
            : choose “Change dates” and you will see whether the new dates are free and what they cost before you
            confirm.
          </li>
          <li>
            If the new dates cost more, the difference is added to your balance. If they cost less, our team makes
            the change and the difference follows the refund rules above.
          </li>
          <li>Closer to arrival than that, call or WhatsApp us and we will do what we can.</li>
          <li>Nights you do not use after you have checked in are not refunded.</li>
        </ul>
      </LegalSection>

      <LegalSection title="If we cancel">
        <p>
          If we have to cancel a confirmed stay, for example because of a fault that makes the home unsafe, we will
          offer you a comparable home or a full refund of everything you paid. You choose.
        </p>
      </LegalSection>

      <LegalSection title="Things outside anyone’s control">
        <p>
          If a flight ban, a border closure, a government order or a serious emergency stops you travelling, tell us
          as soon as you can. We will move your dates or refund you fairly, whatever the dates above say.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
