"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe } from "lucide-react";
import { LANGUAGES, useI18n } from "./i18n";

/**
 * Language dropdown. One close mechanism only: the full-screen overlay behind
 * the menu catches every outside click (and blocks page interaction while
 * open), so there is no separate document-level listener to clean up.
 *
 * ARIA: the trigger declares a menu; the panel and options carry menu roles
 * so screen readers announce the control as what it is. The native-language
 * label is the accessible name; the ISO code is presentation only, and each
 * option carries lang={code} so assistive tech pronounces it correctly.
 */
export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs tracking-[0.15em] uppercase text-white/70 hover:text-[#0d9488] transition-colors px-2 py-1.5"
        aria-label="Switch language"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium">{current.code.toUpperCase()}</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            {/* Click-away layer: also prevents stray interaction with the page beneath. */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2 z-20 bg-[#0a0e1a] border border-white/15 min-w-[160px]"
              role="menu"
              aria-label="Available languages"
            >
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  role="menuitem"
                  aria-current={lang === l.code || undefined}
                  onClick={() => {
                    setLang(l.code);
                    setOpen(false);
                  }}
                  lang={l.code}
                  className={`flex w-full items-center justify-between gap-3 text-left px-4 py-2.5 text-xs tracking-wide transition-colors ${
                    lang === l.code
                      ? "bg-[#0d9488]/10 text-[#0d9488]"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span>{l.label}</span>
                  <span className="text-[10px] uppercase opacity-60" aria-hidden="true">
                    {l.code}
                  </span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
