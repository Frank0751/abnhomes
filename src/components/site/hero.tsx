"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { ChevronDown, MapPin } from "lucide-react";

/**
 * Cinematic Hero with Google Flow style animated "ABN HOMES" text reveal.
 * A slow-motion film of a real ABN Homes gated community plays, muted and
 * looping, blended behind the wordmark. Each letter performs a 3D flip + blur
 * + translateY reveal in sequence, with a teal sweep shimmer overlay and an
 * ambient particle field. The name animation is intentionally left untouched.
 */
export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const letters = "ABN HOMES".split("");

  return (
    <section
      id="home"
      ref={ref}
      className="relative flex min-h-[100svh] w-full flex-col overflow-hidden bg-[#0a0e1a] [@media(min-height:640px)]:h-[100svh]"
    >
      {/* Background film + poster with slow Ken Burns drift */}
      <motion.div
        style={{ scale: bgScale, opacity: bgOpacity }}
        className="absolute inset-0"
      >
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
        {/* Multi-layer gradient overlays for depth and legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e1a]/80 via-[#0a0e1a]/55 to-[#0a0e1a]/95" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0e1a]/80 via-transparent to-[#0a0e1a]/45" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,14,26,0.55)_100%)]" />
      </motion.div>

      {/* Animated particle field */}
      <ParticleField />

      {/* Vertical side labels */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 2.4, duration: 0.8 }}
        className="absolute left-5 lg:left-10 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 z-20"
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
        transition={{ delay: 2.4, duration: 0.8 }}
        className="absolute right-5 lg:right-10 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 z-20"
      >
        <div className="w-px h-20 bg-gradient-to-b from-transparent via-[#0d9488]/60 to-transparent" />
        <span className="text-[10px] tracking-[0.4em] text-[#0d9488] font-medium" style={{ writingMode: "vertical-rl" }}>
          LUXURY LIVING
        </span>
        <div className="w-px h-20 bg-gradient-to-b from-transparent via-[#0d9488]/60 to-transparent" />
      </motion.div>

      {/* Main content (single centered column, all elements in normal flow) */}
      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-30 flex flex-1 flex-col items-center justify-center px-6 pt-24 pb-24 text-center"
      >
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="flex items-center gap-3 mb-7"
        >
          <span className="w-8 sm:w-10 h-px bg-[#0d9488]" />
          <span className="text-[10px] sm:text-[11px] md:text-xs tracking-[0.35em] sm:tracking-[0.4em] text-[#0d9488] font-medium uppercase">
            ABN Homes Company Limited
          </span>
          <span className="w-8 sm:w-10 h-px bg-[#0d9488]" />
        </motion.div>

        {/* Animated ABN HOMES wordmark (animation preserved) */}
        <h1
          className="relative font-serif text-white text-[15vw] md:text-[12vw] lg:text-[9rem] xl:text-[11rem] leading-[0.95] tracking-[-0.04em] font-bold whitespace-nowrap"
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
                  delay: 0.9 + i * 0.12,
                  duration: 0.9,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="inline-block"
                style={{ transformOrigin: "bottom center" }}
              >
                {letter === " " ? " " : letter}
              </motion.span>
            ))}
          </span>
          {/* Teal sweep shimmer overlay */}
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.0, duration: 0.6 }}
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
                    animation: `shimmer 3.5s ease-in-out ${2 + i * 0.1}s infinite`,
                  }}
                >
                  {letter === " " ? " " : letter}
                </span>
              ))}
            </span>
          </motion.span>
        </h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2, duration: 0.9 }}
          className="mt-7 font-display text-xl md:text-2xl lg:text-3xl text-white/90 tracking-wide max-w-2xl"
        >
          Building Dreams in Every Home.
        </motion.p>

        {/* Subline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.6, duration: 0.9 }}
          className="mt-4 text-sm md:text-base text-white/65 max-w-xl leading-relaxed font-sans"
        >
          Thoughtfully designed luxury apartments and homes across Accra,
          Ghana. From Tantra Hill to Achimota Petroleum Estate, every residence
          is crafted for those who expect more from where they live.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.9, duration: 0.8 }}
          className="mt-9 flex flex-col sm:flex-row items-center gap-4"
        >
          <button
            onClick={() => document.querySelector("#residences")?.scrollIntoView({ behavior: "smooth" })}
            className="group relative px-8 py-4 bg-[#0d9488] text-[#0a0e1a] font-semibold tracking-wide text-sm uppercase overflow-hidden transition-all duration-300 hover:shadow-[0_20px_50px_-15px_rgba(13,148,136,0.8)]"
          >
            <span className="relative z-10">Explore Residences</span>
            <span className="absolute inset-0 bg-[#14b8a6] translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="absolute inset-0 flex items-center justify-center text-[#0a0e1a] font-semibold tracking-wide text-sm uppercase translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              Explore Residences
            </span>
          </button>
          <button
            onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
            className="px-8 py-4 border border-white/30 text-white font-medium tracking-wide text-sm uppercase hover:bg-white/10 hover:border-white/60 transition-all duration-300"
          >
            Schedule a Visit
          </button>
        </motion.div>

        {/* Location line (in normal flow, no longer overlapping the buttons) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.2, duration: 0.8 }}
          className="mt-8 flex items-center gap-2 text-white/60 text-[11px] sm:text-xs tracking-[0.2em]"
        >
          <MapPin className="h-3.5 w-3.5 text-[#0d9488] shrink-0" />
          <span>8 Asiko Street, Tantra Hill, Accra, Ghana</span>
        </motion.div>
      </motion.div>

      {/* Scroll indicator (sits just above the marquee, hidden on short screens) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.4, duration: 0.8 }}
        className="pointer-events-none absolute bottom-16 left-1/2 z-30 hidden -translate-x-1/2 flex-col items-center gap-2 [@media(min-height:720px)]:flex"
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
        transition={{ delay: 3.6, duration: 0.8 }}
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

/** Floating teal particle field for ambient depth */
function ParticleField() {
  const [particles, setParticles] = useState<
    Array<{ size: number; left: number; top: number; delay: number; duration: number; xShift: number }>
  >([]);

  useEffect(() => {
    const generated = Array.from({ length: 28 }).map(() => ({
      size: 1 + Math.random() * 3,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 6,
      duration: 6 + Math.random() * 8,
      xShift: Math.random() * 20 - 10,
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticles(generated);
  }, []);

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
