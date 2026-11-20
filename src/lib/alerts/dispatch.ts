/**
 * Raising an alert.
 *
 * One call from wherever the thing happened; this module decides who hears
 * about it and how. Three fan-outs, in order of how much they cost:
 *
 *   1. The LOG — one row per event, always written. It is what the morning
 *      digest reads, and it leaves a record of what was raised even when
 *      nobody was configured to listen.
 *   2. The BELL — one in-app notification per member of staff whose role
 *      cares, plus anyone set to hear everything. Free, so everyone gets it.
 *   3. The CHANNELS — email and SMS, for INSTANT events only, and only to
 *      people who have asked to be reached that way. SMS costs money per
 *      message in Ghana, so it is opt-in and carries one line, not a page.
 *
 * NOTHING HERE MAY THROW. An alert that fails must never roll back the
 * payment or booking that caused it. Every path is wrapped, and a failure is
 * logged and swallowed.
 */

import { db } from '@/lib/db'
import { queueMessage, emailHtml } from '@/lib/notify'
import { definitionFor, type AlertEvent } from './registry'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abnhomes.vercel.app'

export type RaiseArgs = {
  /** One-line heading. Reads on a phone's lock screen, so keep it short. */
  title: string
  /** The detail. Shown in the bell, the email and the digest, not in SMS. */
  body?: string
  /** Where in the admin to go. Path only, e.g. "/admin/bookings/abc". */
  link?: string
  propertyId?: string | null
  /** Carried into the digest so it can be rendered without re-querying. */
  metadata?: Record<string, unknown>
}

/**
 * Tell whoever needs to know that something happened.
 *
 * Safe to call from inside a transaction's caller but NOT from inside the
 * transaction itself: it writes with the global client, so a read of a row
 * being written in an open transaction would not see it. Call it after the
 * commit, the way `afterPaymentRecorded` does.
 */
export async function raiseAlert(event: AlertEvent, args: RaiseArgs): Promise<void> {
  const def = definitionFor(event)

  try {
    await db.alertLog.create({
      data: {
        event,
        urgency: def.urgency,
        title: args.title,
        body: args.body ?? null,
        link: args.link ?? null,
        propertyId: args.propertyId ?? null,
        metadata: (args.metadata ?? undefined) as never,
        // An INSTANT event is sent now, so it must not also appear in the
        // morning digest. Marking it as it is written is simpler than
        // filtering on urgency in two places later.
        digestedAt: def.urgency === 'INSTANT' ? new Date() : null,
      },
    })
  } catch (error) {
    console.error(`[alerts] could not log ${event}`, error)
  }

  const audience = await audienceFor(event)

  await Promise.allSettled([
    ring(audience.bell, def.category, args),
    def.urgency === 'INSTANT' ? reach(audience.reachable, event, args) : Promise.resolve(),
  ])
}

// ---------------------------------------------------------------- audience

type Recipient = {
  id: string
  name: string
  email: string | null
  phone: string | null
  alertEmail: boolean
  alertSms: boolean
}

/**
 * Who hears about this event.
 *
 * Two overlapping groups: staff whose ROLE covers it, and anyone whose own
 * setting says they want more than their role. The second group is "the
 * boss" — someone who wants the whole picture without being given powers
 * over the system to get it.
 */
async function audienceFor(event: AlertEvent): Promise<{
  bell: Recipient[]
  reachable: Recipient[]
}> {
  const def = definitionFor(event)

  try {
    const staff = await db.user.findMany({
      where: {
        active: true,
        suspendedAt: null,
        OR: [
          { role: { in: def.roles } },
          // IMPORTANT hears the instant ones; EVERYTHING hears those and
          // gets the morning digest besides.
          { alertLevel: def.urgency === 'INSTANT' ? { in: ['IMPORTANT', 'EVERYTHING'] } : 'EVERYTHING' },
        ],
      },
      select: {
        id: true, name: true, email: true, phone: true,
        alertEmail: true, alertSms: true, alertLevel: true,
      },
    })

    return {
      bell: staff,
      // Only people who opted into a channel, and only those who asked to
      // hear beyond their role — a front desk clerk should not be texted at
      // midnight merely for holding the role that owns bookings.
      reachable: staff.filter((u) => u.alertLevel !== 'NONE'),
    }
  } catch (error) {
    console.error(`[alerts] could not resolve the audience for ${event}`, error)
    return { bell: [], reachable: [] }
  }
}

// -------------------------------------------------------------------- bell

async function ring(people: Recipient[], category: string, args: RaiseArgs): Promise<void> {
  if (people.length === 0) return
  try {
    await db.notification.createMany({
      data: people.map((p) => ({
        userId: p.id,
        category,
        title: args.title,
        body: args.body ?? null,
        link: args.link ?? null,
      })),
    })
  } catch (error) {
    console.error('[alerts] in-app fan-out failed', error)
  }
}

// ---------------------------------------------------------------- channels

async function reach(people: Recipient[], event: AlertEvent, args: RaiseArgs): Promise<void> {
  const url = args.link ? `${APP_URL}${args.link}` : `${APP_URL}/admin`

  await Promise.allSettled(
    people.flatMap((person) => {
      const jobs: Promise<unknown>[] = []

      if (person.alertEmail && person.email) {
        jobs.push(
          queueMessage({
            channel: 'EMAIL',
            to: person.email,
            template: `alert.${event}`,
            entityType: 'AlertUser',
            // Dedupe is per recipient per event instance, so two people both
            // get it but neither gets it twice if the caller retries.
            entityId: `${event}:${args.metadata?.ref ?? args.title}:${person.id}`,
            dedupe: true,
            subject: args.title,
            body: emailHtml({
              heading: args.title,
              lines: [args.body ?? 'Open the console for the detail.'],
              cta: { label: 'Open in the console', url },
            }),
          })
        )
      }

      // SMS costs credits per message, so it carries the headline only and
      // never the body. Someone who wants the detail opens the console.
      if (person.alertSms && person.phone) {
        jobs.push(
          queueMessage({
            channel: 'SMS',
            to: person.phone,
            template: `alert.${event}`,
            entityType: 'AlertUser',
            entityId: `${event}:${args.metadata?.ref ?? args.title}:${person.id}`,
            dedupe: true,
            body: `${args.title} — ABN Homes.`,
          })
        )
      }

      return jobs
    })
  )
}
