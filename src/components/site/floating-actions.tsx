"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, X } from "lucide-react";
import { useI18n } from "./i18n";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export function FloatingActions() {
  const [showTop, setShowTop] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 800);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* WhatsApp button + chat bubble */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="bg-white border border-[#e8e3d8] shadow-2xl w-80 max-w-[calc(100vw-3rem)]"
            >
              <div className="bg-[#0a0e1a] p-5 text-white relative">
                <button
                  onClick={() => setChatOpen(false)}
                  className="absolute top-4 right-4 text-white/60 hover:text-white"
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-[#0d9488] flex items-center justify-center">
                    <WhatsAppIcon className="h-5 w-5 text-[#0a0e1a]" />
                  </div>
                  <div>
                    <div className="font-serif text-lg leading-tight">{t("chat.teamName")}</div>
                    <div className="text-xs text-[#0d9488] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      {t("chat.repliesFast")}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="bg-[#faf8f3] p-4 mb-4 text-sm text-[#3a3530] leading-relaxed">
                  {t("chat.welcome")}
                </div>
                <a
                  href="https://wa.me/233541704048?text=Hello%20ABN%20Homes%2C%20I%20would%20like%20to%20learn%20more%20about%20your%20residences."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 bg-[#25D366] hover:bg-[#1da851] text-white font-semibold tracking-wide text-sm transition-colors"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  {t("chat.start")}
                </a>
                <div className="mt-3 text-center">
                  <a
                    href="tel:+233541704048"
                    className="text-xs tracking-[0.2em] uppercase text-[#6b6253] hover:text-[#0d9488] transition-colors"
                  >
                    {t("chat.orCall")}
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-3 items-end">
          <AnimatePresence>
            {showTop && (
              <motion.button
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="w-12 h-12 bg-[#0a0e1a] text-white hover:bg-[#1a1f2e] flex items-center justify-center shadow-lg transition-colors"
                aria-label="Back to top"
              >
                <ArrowUp className="h-5 w-5" />
              </motion.button>
            )}
          </AnimatePresence>

          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.5, duration: 0.4 }}
            onClick={() => setChatOpen(!chatOpen)}
            className="relative w-14 h-14 bg-[#25D366] hover:bg-[#1da851] text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(37,211,102,0.4)] transition-colors animate-pulse-ring"
            aria-label="Open WhatsApp chat"
          >
            {chatOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <WhatsAppIcon className="h-7 w-7" />
            )}
          </motion.button>
        </div>
      </div>
    </>
  );
}
