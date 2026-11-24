"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useI18n } from "./i18n";

/**
 * Shared full-height hero header for inner pages (About, Residences, etc.).
 * Full-bleed image with a Ken Burns drift, editorial bottom-aligned title
 * and a breadcrumb.
 *
 * title/subtitle may be passed directly (English strings) or as dictionary
 * keys via titleKey/subtitleKey — when a key is given it wins, so inner
 * pages get translated banners without changing the call shape.
 */
export function PageHero({
  title,
  subtitle,
  titleKey,
  subtitleKey,
  bgImage,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  titleKey?: string;
  subtitleKey?: string;
  bgImage: string;
  breadcrumb: string;
}) {
  const { t } = useI18n();
  const resolvedTitle = titleKey ? t(titleKey) : title;
  const resolvedSubtitle = subtitleKey ? t(subtitleKey) : subtitle;

  return (
    <section className="relative flex h-[100svh] min-h-[560px] w-full flex-col overflow-hidden bg-[#0c1a16]">
      {/* Background image with slow Ken Burns drift */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 animate-ken-burns bg-cover bg-center"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1a16] via-[#0c1a16]/55 to-[#0c1a16]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c1a16]/70 via-transparent to-transparent" />
      </div>

      {/* Content, anchored toward the bottom for an editorial feel */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-end px-5 pb-24 pt-28 lg:px-10 lg:pb-28">
        <motion.nav
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] text-white/55"
        >
          <Link href="/" className="transition-colors hover:text-[#00a878]">
            {t("pagehero.home")}
          </Link>
          <ChevronRight className="h-3 w-3 rtl:rotate-180" />
          <span className="text-[#00a878]">{breadcrumb}</span>
        </motion.nav>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          <h1 className="mx-auto max-w-4xl font-serif text-4xl leading-[1.05] tracking-[-0.02em] text-white md:text-5xl lg:text-7xl">
            {resolvedTitle}
          </h1>
          {resolvedSubtitle && (
            <p className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-white/70 md:text-lg">
              {resolvedSubtitle}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
