"use client";

import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@medivi/ui/components/ui/select";
import { useI18n } from "./locale-provider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return <Select value={locale} onValueChange={(value) => setLocale(value as "pt-BR" | "en")}><SelectTrigger className="w-[104px]" aria-label={t("language")}><Languages className="size-4"/><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pt-BR">PT-BR</SelectItem><SelectItem value="en">EN</SelectItem></SelectContent></Select>;
}
