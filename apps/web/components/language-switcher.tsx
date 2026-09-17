"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@medivi/ui/components/ui/select";
type Locale = "pt-BR" | "en";

export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();

  function changeLocale(nextLocale: string) {
    document.cookie = `medivi-locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = nextLocale;
    router.refresh();
  }

  return (
    <Select value={locale} onValueChange={changeLocale}>
      <SelectTrigger className="h-9 w-20 gap-1 rounded-full border-border/70 bg-muted/50 px-3 text-xs font-semibold shadow-none hover:bg-muted" aria-label={label}>
        <Languages className="size-4 text-muted-foreground" />
        <SelectValue>{locale === "pt-BR" ? "PT" : "EN"}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" side="bottom" sideOffset={4} align="end" className="language-select-content min-w-44 rounded-xl p-1">
        <SelectItem value="pt-BR" className="rounded-lg">Português (Brasil)</SelectItem>
        <SelectItem value="en" className="rounded-lg">English</SelectItem>
      </SelectContent>
    </Select>
  );
}
