"use client";
import { useI18n } from "./locale-provider";
export function LanguageSwitcher() { const { locale, setLocale, t } = useI18n(); return <button type="button" className="arm-ui min-h-11 border border-[#0b0a09] bg-[linear-gradient(#2e2620,#1e1916)] px-3 text-[13px] tracking-widest text-[#cbb98f]" aria-label={t("language")} onClick={() => setLocale(locale === "en" ? "pt-BR" : "en")}>{locale === "en" ? "EN" : "PT"}</button>; }
