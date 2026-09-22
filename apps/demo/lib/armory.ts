import { COPY, DEPTS, GOODS, RARITY } from "./armory-data";
import type { Locale } from "./i18n";

export { COPY, DEPTS, GOODS };
export type ArmoryKey = keyof typeof COPY.en;
export type ArmoryGood = (typeof GOODS)[number];
export const armoryText = (locale: Locale, key: ArmoryKey): string => {
  const value = COPY[locale === "en" ? "en" : "pt"][key];
  return typeof value === "string" ? value : "";
};
export const goodFor = (slug: string) => GOODS.find((good) => good.slug === slug);
export const deptFor = (slug: string) => DEPTS.find((dept) => dept.slug === slug);
export const localizedGood = (locale: Locale, slug: string) => { const good = goodFor(slug); return good ? good[locale === "en" ? "en" : "pt"] : undefined; };
export const localizedDept = (locale: Locale, slug: string) => { const dept = deptFor(slug); return dept ? dept[locale === "en" ? "en" : "pt"] : undefined; };
export const rarity = (locale: Locale, level: number) => RARITY[locale === "en" ? "en" : "pt"][level] ?? "";
export const roman = (value: number) => { if (value < 1) return "—"; let rest = value; let result = ""; for (const [n, glyph] of [[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]] as const) { while (rest >= n) { result += glyph; rest -= n; } } return result; };
export const mark = (name: string, tone: "bone" | "bronze" | "ink" = "bone") => `/mk/${name}-${tone}.svg`;
