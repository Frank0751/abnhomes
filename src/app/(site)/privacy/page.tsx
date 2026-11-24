import type { Metadata } from 'next'
import { LegalPage, LegalSection } from '@/components/site/legal-page'
import { COMPANY } from '@/lib/abn-data'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What ABN Homes collects when you book, rent or enquire, why, who sees it, and your rights under Ghana’s Data Protection Act.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={`${COMPANY.fullName} runs this website and is responsible for the personal information you give us through it. This page says what we collect, why, and what you can ask us to do with it.`}
      updated="24 November 2026"
    >
      <LegalSection title="What we collect">
        <ul>
          <li>
            <strong>When you book a stay:</strong> your name, phone number, email address, the number of guests, your
            dates, your expected arrival time and anything you write in the notes.
          </li>
          <li>
            <strong>When you apply to rent or buy:</strong> the details on the application form, which can include
            your Ghana Card number, employer and references.
          </li>
          <li>
            <strong>When you pay:</strong> the amount, date, method and reference. Card and Mobile Money details are
            entered on our payment provider’s page. We never see or store your card number or PIN.
          </li>
          <li>
            <strong>When you enquire, book a viewing or join our newsletter:</strong> what you type into that form.
          </li>
          <li>
            <strong>When you stay with us:</strong> identification shown at check-in where the law requires it,
            faults you report and reviews you write.
          </li>
          <li>
            <strong>Automatically:</strong> basic technical records every website keeps, such as the pages requested,
            the time, and the type of device and browser.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Why we use it">
        <ul>
          <li>To take, confirm and manage your booking, tenancy or purchase.</li>
          <li>To send you confirmations, receipts, check-in details and reminders by email, SMS or WhatsApp.</li>
          <li>To take payment, issue receipts and refunds, and keep the accounts the law requires.</li>
          <li>To keep our homes, staff and other guests safe, and to prevent fraud.</li>
          <li>To answer your questions and deal with complaints.</li>
          <li>To send news and offers, only if you asked for them. Every message has a way to stop.</li>
        </ul>
        <p>We do not sell your information, and we do not use it for advertising on other websites.</p>
      </LegalSection>

      <LegalSection title="Who sees it">
        <ul>
          <li>Our own staff, limited to what their job needs. A housekeeper sees arrivals, not payments.</li>
          <li>The owner of a home we manage for someone else sees booking dates and income, not your contact details.</li>
          <li>
            Companies that provide services to us and act only on our instructions: our payment provider, our email,
            SMS and WhatsApp delivery providers, and the companies that host this website and its database. Some of
            these store information outside Ghana.
          </li>
          <li>Public authorities, when the law requires us to.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <ul>
          <li>Booking, tenancy and payment records: for as long as tax and accounting law requires us to keep them.</li>
          <li>Enquiries that do not become a booking: up to two years.</li>
          <li>Newsletter details: until you unsubscribe.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          We use only what the site needs to work: a cookie that keeps you signed in to your portal, and a setting
          saved in your browser that remembers your language. We do not use advertising or tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="Keeping it safe">
        <p>
          The site is served over an encrypted connection, access for staff is limited by role and building, and
          changes to records are logged. No system is perfectly secure; if something goes wrong that affects you, we
          will tell you and the regulator.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Under Ghana’s Data Protection Act, 2012 (Act 843) you can ask us to:</p>
        <ul>
          <li>tell you what we hold about you and give you a copy;</li>
          <li>correct anything that is wrong or out of date;</li>
          <li>delete information we no longer have a reason to keep;</li>
          <li>stop sending you marketing, at any time.</li>
        </ul>
        <p>
          Contact us using the details below and we will answer within 30 days. If you are not satisfied you can
          complain to the Data Protection Commission of Ghana.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          You must be 18 or older to book. Children are welcome as guests of an adult, and we collect nothing about
          them beyond the number staying.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>If we change this policy we will update this page and its date. Significant changes are announced on the site.</p>
      </LegalSection>
    </LegalPage>
  )
}
