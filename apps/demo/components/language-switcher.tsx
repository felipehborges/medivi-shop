"use client";
import { useI18n } from "./locale-provider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <button
      className="language-control"
      aria-label={
        locale === "en" ? "Mudar para português" : "Switch to English"
      }
      onClick={() => setLocale(locale === "en" ? "pt-BR" : "en")}
    >
      {locale === "en" ? "EN" : "PT"}
    </button>
  );
}
