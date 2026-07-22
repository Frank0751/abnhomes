"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";

/**
 * Shared full-height hero header for inner pages (About, Residences, etc.).
 * Full-bleed image with a Ken Burns drift, editorial bottom-aligned title,
 * breadcrumb and an optional subtitle, plus a subtle scroll cue.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  bgImage,
  breadcrumb,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  bgImage: string;
  breadcrumb: string;
}) {
  return (
    <section className="relative flex h-[100svh] min-h-[560px] w-full flex-col overflow-hidden bg-[#0a0e1a]">
      {/* Background image with slow Ken Burns drift */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 animate-ken-burns bg-cover bg-center"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/55 to-[#0a0e1a]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0e1a]/70 via-transparent to-transparent" />
      </div>

      {/* Content, anchored toward the bottom for an editorial feel */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-end px-5 pb-24 pt-28 lg:px-10 lg:pb-28">
        <motion.nav
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/55"
        >
          <Link href="/" className="transition-colors hover:text-[#0d9488]">
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[#0d9488]">{breadcrumb}</span>
        </motion.nav>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px w-10 bg-[#0d9488]" />
            <span className="text-[11px] font-medium uppercase tracking-[0.4em] text-[#0d9488]">
              {eyebrow}
            </span>
          </div>
          <h1 className="max-w-4xl font-serif text-4xl leading-[1.05] tracking-[-0.02em] text-white md:text-5xl lg:text-7xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
              {subtitle}
            </p>
          )}
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.8 }}
        className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 [@media(min-height:640px)]:flex"
      >
        <span className="text-[10px] uppercase tracking-[0.4em] text-white/45">
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="text-[#0d9488]"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </motion.div>
    </section>
  );
}
