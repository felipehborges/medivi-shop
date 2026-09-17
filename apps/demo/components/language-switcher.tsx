"use client";

import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@medivi/ui/components/ui/select";
import { useI18n } from "./locale-provider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return <Select value={locale} onValueChange={(value) => setLocale(value as "pt-BR" | "en")}><SelectTrigger className="h-9 w-20 gap-1 rounded-full border-border/70 bg-muted/50 px-3 text-xs font-semibold shadow-none hover:bg-muted" aria-label={t("language")}><Languages className="size-4 text-muted-foreground"/><SelectValue>{locale === "pt-BR" ? "PT" : "EN"}</SelectValue></SelectTrigger><SelectContent position="popper" side="bottom" sideOffset={4} align="end" className="language-select-content min-w-44 rounded-xl p-1"><SelectItem value="pt-BR" className="rounded-lg">Português (Brasil)</SelectItem><SelectItem value="en" className="rounded-lg">English</SelectItem></SelectContent></Select>;
}
