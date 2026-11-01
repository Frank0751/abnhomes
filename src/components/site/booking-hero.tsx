"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, MapPin, Search, ShieldCheck, Sparkles, Wallet } from "lucide-react";

/**
 * Booking-first hero.
 *
 * The cinematic film, the wordmark reveal and the ambient field stay — they
 * are the brand — but the first thing a visitor can act on is the search
 * card: dates in, live availability out. Everything else on the page sits
 * below what a guest came here to do.
 */

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function BookingHero() {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.25]);

  const now = new Date();
  const [checkIn, setCheckIn] = useState(iso(now));
  const [checkOut, setCheckOut] = useState(iso(addDays(now, 2)));
  const [guests, setGuests] = useState(2);
  const [error, setError] = useState<string | null>(null);

  function search(ci: string, co: string, g: number) {
    const a = new Date(ci);
    const b = new Date(co);
    if (!ci || !co || b <= a) {
      setError("Your departure date needs to be after your arrival date.");
      return;
    }
    setError(null);
    router.push(`/book?checkIn=${ci}&checkOut=${co}&guests=${g}`);
  }

  function onCheckIn(value: string) {
    setCheckIn(value);
    if (value && new Date(checkOut) <= new Date(value)) {
      // Standard rate plan asks for two nights; start there.
      setCheckOut(iso(addDays(new Date(value), 2)));
    }
  }

  const letters = "ABN HOMES".split("");

  return (
    <section
      id="home"
      ref={ref}
      className="relative flex min-h-[100svh] w-full flex-col overflow-hidden bg-[#0a0e1a] [@media(min-height:760px)]:h-[100svh]"
    >
      {/* Background film + poster with slow Ken Burns drift */}
      <motion.div style={{ scale: bgScale, opacity: bgOpacity }} className="absolute inset-0">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/images/abn-real/hero-poster.jpg"
          aria-hidden="true"
        >
          <source src="/videos/hero-loop.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e1a]/85 via-[#0a0e1a]/60 to-[#0a0e1a]/95" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0e1a]/80 via-transparent to-[#0a0e1a]/45" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,14,26,0.55)_100%)]" />
      </motion.div>

      <ParticleField />

      {/* Vertical side labels */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        className="absolute left-5 lg:left-10 top-1/2 -translate-y-1/2 hidden xl:flex flex-col items-center gap-4 z-20"
      >
        <div className="w-px h-20 bg-gradient-to-b from-transparent via-[#0d9488]/60 to-transparent" />
        <span className="text-[10px] tracking-[0.4em] text-[#0d9488] font-medium rotate-180" style={{ writingMode: "vertical-rl" }}>
          EST. ACCRA
        </span>
        <div className="w-px h-20 bg-gradient-to-b from-transparent via-[#0d9488]/60 to-transparent" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        className="absolute right-5 lg:right-10 top-1/2 -translate-y-1/2 hidden xl:flex flex-col items-center gap-4 z-20"
      >
        <div className="w-px h-20 bg-gradient-to-b from-transparent via-[#0d9488]/60 to-transparent" />
        <span className="text-[10px] tracking-[0.4em] text-[#0d9488] font-medium" style={{ writingMode: "vertical-rl" }}>
          SERVICED APARTMENTS
        </span>
        <div className="w-px h-20 bg-gradient-to-b from-transparent via-[#0d9488]/60 to-transparent" />
      </motion.div>

      {/* Main content: wordmark, then the search card front and centre */}
      <div className="relative z-30 flex flex-1 flex-col items-center justify-center px-5 sm:px-6 pt-24 pb-32 text-center">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="flex items-center gap-3 mb-5"
        >
          <span className="w-8 sm:w-10 h-px bg-[#0d9488]" />
          <span className="text-[10px] sm:text-[11px] tracking-[0.35em] text-[#0d9488] font-medium uppercase">
            ABN Homes Company Limited
          </span>
          <span className="w-8 sm:w-10 h-px bg-[#0d9488]" />
        </motion.div>

        {/* Animated ABN HOMES wordmark (brand animation preserved, quickened) */}
        <h1
          className="relative font-serif text-white text-[13vw] md:text-[10vw] lg:text-[6.5rem] xl:text-[8rem] leading-[0.95] tracking-[-0.04em] font-bold whitespace-nowrap"
          style={{ perspective: "800px" }}
          aria-label="ABN HOMES"
        >
          <span className="inline-flex flex-wrap justify-center">
            {letters.map((letter, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: "60%", rotateX: -90 }}
                animate={{ opacity: 1, y: "0%", rotateX: 0 }}
                transition={{
                  delay: 0.45 + i * 0.075,
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="inline-block"
                style={{ transformOrigin: "bottom center" }}
              >
                {letter === " " ? "\u00A0" : letter}
              </motion.span>
            ))}
          </span>
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.6 }}
            className="absolute inset-0 pointer-events-none"
          >
            <span className="inline-flex flex-wrap justify-center">
              {letters.map((letter, i) => (
                <span
                  key={i}
                  className="inline-block text-transparent animate-shimmer bg-clip-text"
                  style={{
                    backgroundSize: "200% 100%",
                    WebkitTextFillColor: "transparent",
                    backgroundImage:
                      "linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.85) 50%, transparent 100%)",
                    backgroundClip: "text",
                    animation: `shimmer 3.5s ease-in-out ${1.5 + i * 0.1}s infinite`,
                  }}
                >
                  {letter === " " ? "\u00A0" : letter}
                </span>
              ))}
            </span>
          </motion.span>
        </h1>

        {/* One-line promise, then straight to business */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.8 }}
          className="mt-4 font-display text-lg md:text-2xl text-white/90 tracking-wide"
        >
          Serviced apartments in Accra. Book direct, in under a minute.
        </motion.p>

        {/* The booking card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 w-full max-w-3xl"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search(checkIn, checkOut, guests);
            }}
            className="rounded-sm bg-[#faf8f3] p-4 sm:p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] text-left"
          >
            <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0a0e1a]/70">
              <CalendarDays className="size-3.5 text-[#0d9488]" />
              Check live availability
            </p>

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
              <div className="space-y-1">
                <label htmlFor="hero-check-in" className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0a0e1a]/60">
                  Arrive
                </label>
                <input
                  id="hero-check-in"
                  type="date"
                  value={checkIn}
                  min={iso(now)}
                  onChange={(e) => onCheckIn(e.target.value)}
                  className="w-full rounded-sm border border-black/15 bg-white px-3 py-2.5 text-sm text-[#0a0e1a] outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/25"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="hero-check-out" className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0a0e1a]/60">
                  Leave
                </label>
                <input
                  id="hero-check-out"
                  type="date"
                  value={checkOut}
                  min={iso(addDays(now, 1))}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full rounded-sm border border-black/15 bg-white px-3 py-2.5 text-sm text-[#0a0e1a] outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/25"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="hero-guests" className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0a0e1a]/60">
                  Guests
                </label>
                <select
                  id="hero-guests"
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className="w-full sm:w-24 rounded-sm border border-black/15 bg-white px-3 py-2.5 text-sm text-[#0a0e1a] outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/25"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "guest" : "guests"}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="group relative h-[42px] w-full sm:w-auto overflow-hidden rounded-sm bg-[#0d9488] px-6 text-[#faf8f3] font-semibold tracking-wide text-sm uppercase transition-all duration-300 hover:shadow-[0_16px_40px_-12px_rgba(13,148,136,0.9)]"
              >
                <span className="relative z-10 inline-flex items-center gap-2">
                  <Search className="size-4" />
                  Check
                </span>
                <span className="absolute inset-0 bg-[#14b8a6] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </div>

            {error && (
              <p className="mt-3 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {error}
              </p>
            )}

            {/* Quick stays — one tap fills the card */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[#0a0e1a]/50">
                <Sparkles className="size-3 text-[#0d9488]" />
                Quick stay
              </span>
              {[
                { label: "2 nights", ci: now, co: addDays(now, 2) },
                { label: "This weekend", ci: upcomingSaturday(now), co: upcomingMonday(now) },
                { label: "A week", ci: now, co: addDays(now, 7) },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setCheckIn(iso(chip.ci));
                    setCheckOut(iso(chip.co));
                    setError(null);
                  }}
                  className="rounded-full border border-black/12 bg-white px-3 py-1 text-xs text-[#0a0e1a]/75 transition-colors hover:border-[#0d9488] hover:text-[#0d9488]"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </form>

          {/* Reassurance strip */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] tracking-[0.14em] uppercase text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#14b8a6] opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-[#14b8a6]" />
              </span>
              Live availability
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="size-3.5 text-[#0d9488]" />
              No platform fee
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-[#0d9488]" />
              Confirmed by our team
            </span>
          </div>
        </motion.div>

        {/* Location line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.8 }}
          className="mt-7 flex items-center gap-2 text-white/55 text-[11px] tracking-[0.2em]"
        >
          <MapPin className="h-3.5 w-3.5 text-[#0d9488] shrink-0" />
          <span>8 Asiko Street, Tantra Hill, Accra, Ghana</span>
        </motion.div>

        {/* Secondary path: looking to rent long-term, or to buy */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.8 }}
          className="mt-3 text-xs text-white/45"
        >
          Looking for a yearly tenancy or to buy?{" "}
          <a href="#residences" className="underline underline-offset-4 decoration-[#0d9488]/60 hover:text-white/70 transition-colors">
            Explore residences
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 0.8 }}
        className="pointer-events-none absolute bottom-16 left-1/2 z-30 hidden -translate-x-1/2 flex-col items-center gap-2 [@media(min-height:800px)]:flex"
      >
        <span className="text-[10px] tracking-[0.4em] text-white/50 uppercase">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="text-[#0d9488]"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </motion.div>

      {/* Bottom marquee strip */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.0, duration: 0.8 }}
        className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#0a0e1a]/60 backdrop-blur-sm overflow-hidden"
      >
        <div className="flex whitespace-nowrap animate-marquee py-3">
          {Array.from({ length: 2 }).map((_, set) => (
            <div key={set} className="flex items-center gap-10 px-5 shrink-0">
              {[
                "Furnished Apartments",
                "Tantra Hill",
                "Free WiFi",
                "Private Parking",
                "Achimota Petroleum Estate",
                "Fully Equipped Kitchens",
                "Air Conditioned",
                "Balcony Views",
                "75-inch Smart TVs",
                "Long Stay Friendly",
                "Open Rooftop Bar",
                "24/7 Security",
              ].map((item, i) => (
                <span key={`${set}-${i}`} className="flex items-center gap-3 text-xs tracking-[0.2em] text-white/55 uppercase">
                  <span className="w-1 h-1 rounded-full bg-[#0d9488]" />
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

/** The Saturday of the current week (moves to next Saturday from Thursday). */
function upcomingSaturday(now: Date) {
  const d = addDays(now, 1);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  return d;
}

/** The Monday after the upcoming Saturday. */
function upcomingMonday(now: Date) {
  const sat = upcomingSaturday(now);
  return addDays(sat, 2);
}

/** Floating teal particle field for ambient depth */
function ParticleField() {
  const particles = Array.from({ length: 28 }).map((_, i) => ({
    size: 1 + ((i * 7) % 3),
    left: (i * 37) % 100,
    top: (i * 53) % 100,
    delay: (i * 11) % 60 / 10,
    duration: 6 + ((i * 13) % 80) / 10,
    xShift: ((i * 17) % 20) - 10,
  }));

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.5, 0],
            y: [0, -40, -80],
            x: [0, p.xShift],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute rounded-full bg-[#0d9488]"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.left}%`,
            top: `${p.top}%`,
            boxShadow: "0 0 6px rgba(13,148,136,0.6)",
          }}
        />
      ))}
    </div>
  );
}
