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
      <SelectTrigger className="w-[104px]" aria-label={label}>
        <Languages className="size-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pt-BR">PT-BR</SelectItem>
        <SelectItem value="en">EN</SelectItem>
      </SelectContent>
    </Select>
  );
}
