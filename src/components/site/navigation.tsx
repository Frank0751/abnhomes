"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, MessageCircle } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "./i18n";
import { COMPANY } from "@/lib/abn-data";

const navItems = [
  { key: "nav.home", href: "/" },
  { key: "nav.about", href: "/about" },
  { key: "nav.residences", href: "/residences" },
  { key: "nav.book", href: "/book" },
  { key: "nav.own", href: "/own" },
  { key: "nav.rent", href: "/rent" },
  { key: "nav.amenities", href: "/amenities" },
  { key: "nav.gallery", href: "/gallery" },
  { key: "nav.locations", href: "/locations" },
  { key: "nav.contact", href: "/contact" },
];

/**
 * Three bars that morph into an X. Pure CSS transforms on spans — smoother
 * than swapping two lucide icons, and the hover color follows `bg-current`.
 */
function BurgerIcon({ open }: { open: boolean }) {
  const bar =
    "absolute left-0.5 h-0.5 w-5 bg-current transition-all duration-300 ease-out";
  return (
    <span aria-hidden="true" className="relative block h-6 w-6">
      <span className={`${bar} top-[4px] ${open ? "top-[11px] rotate-45" : ""}`} />
      <span className={`${bar} top-[11px] ${open ? "opacity-0 -translate-x-2" : ""}`} />
      <span className={`${bar} top-[18px] ${open ? "top-[11px] -rotate-45" : ""}`} />
    </span>
  );
}

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Dropdown behavior: Escape closes and hands focus back to the 3-lines
  // button. No scroll lock — the page stays visible behind the panel.
  useEffect(() => {
    if (!menuOpen) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // On non-home pages, the nav should always be dark (since hero isn't full screen)
  const isHome = pathname === "/";
  const forceDark = !isHome || scrolled;

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-500 ${
          forceDark
            ? "glass-dark py-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
            : "bg-transparent py-5"
        }`}
      >
        {/* relative: the dropdown panel anchors to this container, so it always
            opens flush under the header row — directly beneath the button. */}
        <div className="relative max-w-[1400px] mx-auto px-5 lg:px-10 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 shrink-0">
            {/* The hamburger is the site's one navigation control on every
                viewport: far left, 44px tap target, bars morph into an X. The
                menu drops straight down from its edge. */}
            <button
              ref={toggleRef}
              className="flex h-11 w-11 items-center justify-center border border-white/20 text-white transition-colors hover:border-[#14b8a6]/60 hover:text-[#14b8a6] focus-visible:ring-1 focus-visible:ring-[#14b8a6]"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="site-menu"
            >
              <BurgerIcon open={menuOpen} />
            </button>
            <Link href="/" className="flex items-center gap-3 group" aria-label="ABN Homes home">
              <img
                src="/images/logo/abn-homes-logo-real.png"
                alt="ABN Homes Company Limited"
                className="h-9 md:h-10 w-auto transition-transform duration-300 group-hover:scale-[1.03] rounded"
              />
            </Link>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <LanguageSwitcher />
            <a
              href={`tel:${COMPANY.phoneIntl}`}
              className="hidden md:flex items-center gap-2 text-sm text-white/80 hover:text-[#0d9488] transition-colors"
            >
              <Phone className="h-4 w-4" />
              <span className="font-medium">{COMPANY.phone}</span>
            </a>
            <Link
              href="/book"
              className="hidden md:inline-flex items-center px-5 py-2.5 bg-[#0d9488] hover:bg-[#14b8a6] text-white text-sm font-semibold tracking-wide transition-all duration-300 hover:shadow-[0_10px_30px_-10px_rgba(13,148,136,0.7)]"
            >
              {t("cta.bookStay")}
            </Link>
          </div>

          <AnimatePresence>
            {menuOpen && (
              <>
                {/* Click-away layer: any click outside the panel closes it. */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                {/* The menu drops from the button's edge (start-0 mirrors for
                    RTL). Vertical fade-slide reads the same in both directions. */}
                <motion.div
                  key="panel"
                  id="site-menu"
                  ref={panelRef}
                  tabIndex={-1}
                  aria-label="Site menu"
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute top-full start-0 z-20 mt-2 w-[min(28rem,calc(100vw-2.5rem))] max-h-[calc(100dvh-5rem)] overflow-y-auto bg-[#0a0e1a]/95 backdrop-blur-xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.6)] outline-none"
                >
                  {/* This dropdown is the primary nav on every viewport. */}
                  <nav aria-label="Primary" className="px-7 pt-5 pb-2">
                    {navItems.map((item, i) => {
                      const active = pathname === item.href;
                      return (
                        <motion.div
                          key={item.key}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.04 + i * 0.035, duration: 0.25 }}
                        >
                          <Link
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-baseline gap-4 py-3 border-b border-white/5 transition-colors ${
                              active ? "text-[#14b8a6]" : "text-white/90 hover:text-[#14b8a6]"
                            }`}
                          >
                            <span className={`text-[10px] font-mono tracking-widest ${active ? "text-[#14b8a6]/70" : "text-white/30"}`} aria-hidden="true">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="text-2xl font-serif">{t(item.key)}</span>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </nav>

                  {/* Contact + CTA at the foot of the panel, always reachable. */}
                  <div className="px-7 py-5 border-t border-white/10 bg-white/[0.02]">
                    <div className="flex flex-col gap-3">
                      <a href={`tel:${COMPANY.phoneIntl}`} className="flex items-center gap-3 text-white/80 hover:text-[#14b8a6] transition-colors">
                        <Phone className="h-4.5 w-4.5 text-[#0d9488]" />
                        <span className="font-medium">{COMPANY.phone}</span>
                      </a>
                      <a
                        href={COMPANY.whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-white/80 hover:text-[#14b8a6] transition-colors"
                      >
                        <MessageCircle className="h-4.5 w-4.5 text-[#0d9488]" />
                        <span className="font-medium">WhatsApp</span>
                      </a>
                      <Link
                        href="/book"
                        onClick={() => setMenuOpen(false)}
                        className="mt-2 px-6 py-3.5 bg-[#0d9488] hover:bg-[#14b8a6] text-white font-semibold tracking-wide text-center transition-colors"
                      >
                        {t("cta.bookStay")}
                      </Link>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </motion.header>
    </>
  );
}
