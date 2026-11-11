import re, sys

d = '/home/z/my-project/download/slides/'
checks = {
 'slide_15.html': ['03&nbsp;/&nbsp;03', 'Platform &amp; Roadmap',
   'What it is built on, what runs unattended, and what stands between the prototype and commercial launch.'],
 'slide_16.html': ['PLATFORM', 'Boring technology, strict guarantees',
   'Next.js 16 + TypeScript', 'one app for site, console and portals',
   'PostgreSQL 17 on Supabase + Prisma 6', '42-table schema, pooled',
   'NextAuth v5', 'staff password + phone OTP, role matrix',
   'Database guards', 'exclusion constraint (no double bookings), append-only ledger triggers',
   'Idempotency', 'double-submitted payments and bookings are harmless',
   '20s transactions', 'TX_OPTS raised from 5s after a real production timeout (fixed 11 Nov)'],
 'slide_17.html': ['PLATFORM', 'Five jobs run the business overnight',
   'Sweeper', 'daily + 15-min', 'expires unpaid holds, drains the outbox',
   'Outbox drain', 'with sweeper', 'sends SMS, email, WhatsApp with retries',
   'Rent run', 'daily 06:00 UTC', 'invoices every active long-let lease',
   'iCal sync', 'daily 06:17 UTC', 'pulls OTA calendars, blocks booked dates',
   'Keep-alive', 'every 6h', 'stops Supabase free tier pausing',
   'Cron routes are bearer-secret guarded', 'verified 401 on unauthenticated calls'],
 'slide_18.html': ['ROADMAP', 'Four switches to launch, then growth',
   'Go-live switches (env vars, no code)',
   'Paystack live keys', 'real MoMo and card settlement',
   'SMS sender (Arkesel/Hubtel)', 'real OTPs and guest messages',
   'Email sender', 'receipts and confirmations',
   'Credential hygiene', 'rotate DB password, change seeded staff password, sync CRON_SECRET',
   'Then, in order of value', 'WhatsApp Business API for trip updates',
   'Outbound iCal to Airbnb / Booking.com', 'Referral rewards activation',
   'Photo uploads on tasks; trend dashboards; image pipeline'],
 'slide_19.html': ['Built', 'Tested', 'Live',
   'Full platform verification passed 11 Nov 2026', 'every page, every flow',
   'Production E2E:', 'hold, payment, confirmation, notifications, refund', '13/13',
   'Companion deliverables:', 'build documentation (docx), this deck, narrated demo video',
   'abnhomes.vercel.app', 'ABN Homes — Accra, Ghana'],
}

ok = True
for f, needles in checks.items():
    s = open(d + f, encoding='utf-8').read()
    probs = []
    if not s.startswith('<!DOCTYPE html>'): probs.append('no doctype start')
    if not s.rstrip().endswith('</html>'): probs.append('no </html> end')
    if '<link rel="stylesheet" href="global.css">' not in s: probs.append('no global.css link')
    if 'cdn.tailwindcss.com' not in s: probs.append('no tailwind')
    if 'family=Material+Icons' not in s: probs.append('no material icons link')
    if 'class="slide' not in s: probs.append('no .slide root')
    if '<aside data-notes' not in s: probs.append('no notes aside')
    # aside must be last body child
    if not re.search(r'</aside>\s*</body>', s): probs.append('aside not last body child')
    if '<img' in s or '.png' in s or '.jpg' in s or '<svg' in s or 'base64' in s: probs.append('FORBIDDEN image/svg ref')
    for n in needles:
        if n not in s: probs.append('MISSING: ' + n)
    if probs: ok = False
    print(f, 'OK' if not probs else probs)

sys.exit(0 if ok else 1)
