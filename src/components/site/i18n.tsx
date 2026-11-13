"use client";

/**
 * Client-side internationalisation for the public site.
 *
 * The choice lives in localStorage and is applied to <html lang> / <html dir>
 * on mount, so Arabic flips the whole document to RTL and screen readers and
 * search engines see the right language. Dictionaries live in
 * ./dictionaries.ts — one flat key per string, English is the source of truth
 * and the fallback when a key is missing.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries } from "./dictionaries";

export type Language = "en" | "fr" | "es" | "ar" | "de" | "zh";

export const LANGUAGES: { code: Language; label: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "de", label: "Deutsch", dir: "ltr" },
  { code: "zh", label: "中文", dir: "ltr" },
];

export const LANGUAGE_KEY = "abn-lang";

function isLanguage(value: string | null): value is Language {
  return !!value && LANGUAGES.some((l) => l.code === value);
}

type I18nContextValue = {
  lang: Language;
  dir: "ltr" | "rtl";
  setLang: (l: Language) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue>({
  lang: "en",
  dir: "ltr",
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(LANGUAGE_KEY) : null;
    if (isLanguage(stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLangState(stored);
    }
  }, []);

  // Reflect the choice onto the document: language, direction, persistence.
  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    if (typeof window !== "undefined") localStorage.setItem(LANGUAGE_KEY, lang);
  }, [lang]);

  const setLang = (l: Language) => setLangState(l);

  const t = (key: string) => dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key;

  return (
    <I18nContext.Provider value={{ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
