"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Phone } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { COMPANY } from "@/lib/abn-data";

const navItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Residences", href: "/residences" },
  { label: "Amenities", href: "/amenities" },
  { label: "Gallery", href: "/gallery" },
  { label: "Locations", href: "/locations" },
  { label: "Contact", href: "/contact" },
];

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // On non-home pages, the nav should always be dark (since hero isn't full screen)
  const isHome = pathname === "/";
  const forceDark = !isHome || scrolled;

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          forceDark
            ? "glass-dark py-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-5 lg:px-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" aria-label="ABN Homes home">
            <img
              src="/images/logo/abn-homes-logo-real.png"
              alt="ABN Homes Company Limited"
              className="h-9 md:h-10 w-auto transition-transform duration-300 group-hover:scale-[1.03] rounded"
            />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`relative px-4 py-2 text-sm font-medium tracking-wide transition-colors duration-300 group ${
                    isActive ? "text-[#0d9488]" : "text-white/85 hover:text-white"
                  }`}
                >
                  {item.label}
                  <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-px bg-[#0d9488] transition-all duration-300 ${isActive ? "w-3/4" : "w-0 group-hover:w-3/4"}`} />
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <a
              href={`tel:${COMPANY.phoneIntl}`}
              className="hidden md:flex items-center gap-2 text-sm text-white/80 hover:text-[#0d9488] transition-colors"
            >
              <Phone className="h-4 w-4" />
              <span className="font-medium">{COMPANY.phone}</span>
            </a>
            <Link
              href="/contact"
              className="hidden md:inline-flex items-center px-5 py-2.5 bg-[#0d9488] hover:bg-[#14b8a6] text-white text-sm font-semibold tracking-wide transition-all duration-300 hover:shadow-[0_10px_30px_-10px_rgba(13,148,136,0.7)]"
            >
              Book a Tour
            </Link>

            <button
              className="lg:hidden text-white p-2"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden bg-[#0a0e1a]/95 backdrop-blur-xl pt-24 px-6"
          >
            <nav className="flex flex-col gap-2">
              {navItems.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`block text-2xl font-serif py-3 border-b border-white/10 transition-colors ${
                      pathname === item.href ? "text-[#0d9488]" : "text-white/90 hover:text-[#0d9488]"
                    }`}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="mt-8 flex flex-col gap-3">
              <a
                href={`tel:${COMPANY.phoneIntl}`}
                className="flex items-center gap-3 text-white/80"
              >
                <Phone className="h-5 w-5 text-[#0d9488]" />
                <span className="text-lg font-medium">{COMPANY.phone}</span>
              </a>
              <Link
                href="/contact"
                onClick={() => setMenuOpen(false)}
                className="mt-2 px-6 py-3.5 bg-[#0d9488] text-white font-semibold tracking-wide text-center"
              >
                Book a Tour
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
