"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Shared full-height hero header for inner pages (About, Residences, etc.).
 * Full-bleed image with a Ken Burns drift, editorial bottom-aligned title
 * and a breadcrumb.
 */
export function PageHero({
  title,
  subtitle,
  bgImage,
  breadcrumb,
}: {
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
    </section>
  );
}
