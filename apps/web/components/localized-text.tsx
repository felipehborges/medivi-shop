"use client";

import { useLocale } from "./locale-provider";

export function LocalizedText({ text }: { text: string }) {
  const { tr } = useLocale();
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return text;
  return <>{match[1]}{tr(match[2] ?? "")}{match[3]}</>;
}
