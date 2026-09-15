import "server-only";

import { cookies, headers } from "next/headers";

export const locales = ["pt-BR", "en"] as const;
export type Locale = (typeof locales)[number];

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get("medivi-locale")?.value;
  if (saved === "pt-BR" || saved === "en") return saved;

  const acceptLanguage = (await headers()).get("accept-language")?.toLowerCase();
  return acceptLanguage?.startsWith("pt") ? "pt-BR" : "en";
}

const ptBR = {
  "home.title": "Equipamentos para aventureiros",
  "home.featured": "Destaques",
  "home.browseAll": "Ver tudo",
  "header.home": "Página inicial da Medivi Shop",
  "header.signIn": "Entrar",
  "header.signUp": "Criar conta",
  "footer.tagline": "Equipamentos para aventureiros de todas as guildas.",
  "footer.catalog": "Catálogo",
  "footer.search": "Buscar",
  "footer.privacy": "Política de Privacidade",
  "footer.terms": "Termos de Uso",
  "footer.shipping": "Envios e Devoluções",
  "footer.newsletter": "Entre para o boletim da guilda",
  "footer.disclaimer": "Uma loja fictícia — apenas um projeto de portfólio.",
  "language.label": "Idioma",
} as const;

type TranslationKey = keyof typeof ptBR;

const en: Record<TranslationKey, string> = {
  "home.title": "Gear for Adventurers",
  "home.featured": "Featured gear",
  "home.browseAll": "Browse all",
  "header.home": "Medivi Shop home",
  "header.signIn": "Sign in",
  "header.signUp": "Sign up",
  "footer.tagline": "Gear for adventurers of every guild.",
  "footer.catalog": "Catalog",
  "footer.search": "Search",
  "footer.privacy": "Privacy Policy",
  "footer.terms": "Terms of Service",
  "footer.shipping": "Shipping & Returns",
  "footer.newsletter": "Join the guild newsletter",
  "footer.disclaimer": "A fictional store — portfolio project only.",
  "language.label": "Language",
};

export function getTranslations(locale: Locale) {
  const messages: Record<TranslationKey, string> = locale === "pt-BR" ? ptBR : en;
  return (key: TranslationKey) => messages[key];
}
