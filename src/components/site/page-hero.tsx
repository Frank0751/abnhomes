"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Shared hero header for inner pages (About, Residences, etc.)
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
    <section className="relative h-[60vh] min-h-[480px] w-full overflow-hidden bg-[#0a0e1a] flex items-end">
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/60 to-[#0a0e1a]/30" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-5 lg:px-10 pb-16 lg:pb-20 w-full">
        <motion.nav
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-white/50 mb-6"
        >
          <Link href="/" className="hover:text-[#0d9488] transition-colors">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[#0d9488]">{breadcrumb}</span>
        </motion.nav>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="w-10 h-px bg-[#0d9488]" />
            <span className="text-[11px] tracking-[0.4em] text-[#0d9488] font-medium uppercase">
              {eyebrow}
            </span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-7xl text-white leading-[1.05] tracking-[-0.02em] max-w-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 text-white/70 text-base md:text-lg leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
