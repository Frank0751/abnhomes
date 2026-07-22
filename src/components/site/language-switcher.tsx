"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe } from "lucide-react";
import { useI18n } from "./i18n";

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs tracking-[0.15em] uppercase text-white/70 hover:text-[#0d9488] transition-colors px-2 py-1.5"
        aria-label="Switch language"
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="font-medium">{lang.toUpperCase()}</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2 z-20 bg-[#0a0e1a] border border-white/15 min-w-[120px]"
            >
              {[
                { code: "en" as const, label: "English" },
                { code: "fr" as const, label: "Francais" },
              ].map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLang(l.code);
                    setOpen(false);
                  }}
                  className={`block w-full text-left px-4 py-2.5 text-xs tracking-wide transition-colors ${
                    lang === l.code
                      ? "bg-[#0d9488]/10 text-[#0d9488]"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
