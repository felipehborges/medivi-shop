"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Locale, MessageKey } from "@/lib/i18n";
import { messages, translateDemo } from "@/lib/i18n";

const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void } | null>(null);

export function LocaleProvider({ locale: initialLocale, children }: { locale: Locale; children: ReactNode }) {
  const [locale, updateLocale] = useState(initialLocale);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate the static demo from browser preference */
  useEffect(() => {
    const saved = document.cookie.match(/(?:^|; )medivi-locale=([^;]+)/)?.[1];
    const detected: Locale = saved === "pt-BR" || saved === "en"
      ? saved
      : navigator.language.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
    updateLocale(detected);
    document.documentElement.lang = detected;
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setLocale = (next: Locale) => {
    document.cookie = `medivi-locale=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    updateLocale(next);
  };

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useI18n must be used inside LocaleProvider");
  const { locale, setLocale } = context;
  const t = (key: MessageKey) => messages[locale][key];
  const formatMoney = (cents: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(cents / 100);
  return { locale, setLocale, t, tr: (text: string) => translateDemo(locale, text), formatMoney };
}

export function useDemoMessage() {
  const { locale } = useI18n();
  return (key: MessageKey) => messages[locale][key];
}
