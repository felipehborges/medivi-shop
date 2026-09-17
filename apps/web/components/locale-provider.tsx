"use client";

import { createContext, useContext, type ReactNode } from "react";
import { translatedCopy } from "@/lib/translated-copy";

type Locale = "pt-BR" | "en";

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

const ptBR: Record<string, string> = {
  "Search the shop…": "Buscar na loja…", "Search products": "Buscar produtos", "Search": "Buscar",
  "Product categories": "Categorias de produtos", "All": "Todos:", "Your Cart": "Seu carrinho",
  "Swords": "Espadas", "Shields": "Escudos", "Armor": "Armaduras", "Banners": "Estandartes", "Cloaks": "Capas", "Relics": "Relíquias", "Potions": "Poções",
  "Featured": "Destaque", "Out of stock": "Esgotado", "Archive": "Arquivar", "Refund": "Reembolsar", "Placement": "Posição",
  "Your cart is empty": "Seu carrinho está vazio", "Add something from the catalog to get started.": "Adicione um produto do catálogo para começar.",
  "View cart": "Ver carrinho", "Account menu": "Menu da conta", "Account": "Minha conta", "Order history": "Histórico de pedidos", "Wishlist": "Favoritos", "Admin dashboard": "Painel administrativo", "Sign out": "Sair", "Footer": "Rodapé",
};

export function useLocale() {
  const locale = useContext(LocaleContext);
  return { locale, tr: (text: string) => locale === "pt-BR" ? ptBR[text] ?? translatedCopy[text] ?? text : text };
}
