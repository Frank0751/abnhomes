import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, LegalSection } from '@/components/site/legal-page'
import { COMPANY } from '@/lib/abn-data'
import { getCancellationPolicy } from '@/lib/policies'
import { cancellationSummary } from '@/lib/core/cancellation'

// Built ahead of time and refreshed hourly: cheap to serve, and the policy
// from Settings (and the example dates) never go stale for long.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'The terms that apply when you book a stay with ABN Homes: payment, check-in, house rules, cancellations and responsibilities.',
  alternates: { canonical: '/terms' },
}

export default async function TermsPage() {
  const policy = await getCancellationPolicy()

  return (
    <LegalPage
      title="Terms of service"
      intro={`These terms apply when you book a short stay on this website. Your agreement is with ${COMPANY.fullName}, which operates the homes. Long-term tenancies and home purchases have their own written agreements.`}
      updated="24 November 2026"
    >
      <LegalSection title="Booking">
        <ul>
          <li>You must be 18 or older, and the person who books must be one of the guests.</li>
          <li>
            A booking is confirmed when it has been paid for, or when we confirm it to you in writing. An unpaid
            request holds the dates for 48 hours and is then released.
          </li>
          <li>The details you give must be accurate. We may cancel a booking made with false details.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Price and payment">
        <ul>
          <li>The total is shown before you pay. It includes every charge we make for the stay; there are no hidden fees.</li>
          <li>
            Payment is taken by card or Mobile Money through our payment provider. If your bank or network converts
            currency, its rate and charges are between you and them.
          </li>
          <li>Extras you add, such as an airport pickup, are charged at the price shown when you add them.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Cancellations and changes">
        <p>
          {cancellationSummary(policy)} The full rules, including refunds and what happens if we have to cancel, are
          in our{' '}
          <Link href="/cancellation-policy" className="underline underline-offset-2">
            cancellation policy
          </Link>
          , which forms part of these terms.
        </p>
      </LegalSection>

      <LegalSection title="Arriving and leaving">
        <ul>
          <li>Check-in and check-out times are shown on each room’s page and in your confirmation.</li>
          <li>Tell us if you will arrive late. Early check-in and late check-out depend on availability; please ask.</li>
          <li>We may ask to see identification for each adult guest at check-in, as Ghanaian law requires of us.</li>
        </ul>
      </LegalSection>

      <LegalSection title="During your stay">
        <ul>
          <li>Only the guests named on the booking may stay. The number of guests must not exceed what the room sleeps.</li>
          <li>The house rules shown on the room’s page and at checkout apply. Please respect the neighbours.</li>
          <li>No parties or events, and nothing illegal, on the premises.</li>
          <li>Report anything broken or unsafe straight away through your portal or by phone, so we can fix it.</li>
          <li>
            We may enter the home for agreed housekeeping, for repairs you have reported, or in an emergency. We will
            let you know first whenever we reasonably can.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Damage and missing items">
        <p>
          Treat the home as you would your own. You are responsible for damage or loss caused by you or your guests
          beyond normal wear, and we will show you evidence of the cost before asking you to pay for it.
        </p>
      </LegalSection>

      <LegalSection title="If something is not right">
        <p>
          Tell us while you are there, so we have the chance to put it right. If we cannot, we will offer a move to a
          comparable home or a fair refund for the nights affected.
        </p>
      </LegalSection>

      <LegalSection title="Our responsibility">
        <ul>
          <li>We will provide the home as described, clean and in working order.</li>
          <li>
            Power and water supply in Accra can be interrupted by the utilities. We describe each home’s backup
            honestly on its page, and we are not liable for interruptions outside our control.
          </li>
          <li>Your belongings are your responsibility; please use the locks provided.</li>
          <li>Nothing in these terms limits liability that cannot be limited by law.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Reviews">
        <p>
          Only guests who have completed a stay can review it. We publish honest reviews, good or bad, and remove
          only those that are abusive, unlawful or about a different stay.
        </p>
      </LegalSection>

      <LegalSection title="Your information">
        <p>
          How we use personal information is set out in our{' '}
          <Link href="/privacy" className="underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Law">
        <p>These terms are governed by the laws of the Republic of Ghana, and its courts have jurisdiction.</p>
      </LegalSection>
    </LegalPage>
  )
}
