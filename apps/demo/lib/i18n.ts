export type Locale = "pt-BR" | "en";

export const messages = {
  en: {
    demoBanner: "INTERACTIVE PORTFOLIO DEMO · NO REAL PURCHASES OR PAYMENTS",
    armory: "Armory", relics: "Relics", potions: "Potions", admin: "Admin demo",
    wishlist: "Wishlist", cart: "Cart", menu: "Menu", language: "Language",
    safeDemo: "Safe interactive demonstration",
    safeDemoText: "Everything stays in this browser. No account is created, no data is sent, and no payment can occur.",
    footerText: "A fully interactive fantasy commerce interface built as a safe, backend-free portfolio demonstration.",
    explore: "Explore", catalog: "Catalog", demoBehavior: "Demo behavior",
    demoBehaviorText: "Your cart and changes are stored only in local browser storage. Clear them anytime from the admin demo.",
    heroBadge: "Curated for legendary journeys", heroTitle: "Gear for those who answer the call.",
    heroText: "Explore a handcrafted fantasy storefront—from discovery to a completely simulated checkout.",
    enterArmory: "Enter the armory", exploreAdmin: "Explore admin demo",
    browserOnly: "Browser only", noBackend: "No backend or personal data",
    interactive: "Fully interactive", interactiveText: "Cart, checkout and admin",
    portfolio: "Portfolio experience", portfolioText: "Built to showcase the product",
    choosePath: "Choose your path", shopCollection: "Shop by collection", viewAll: "View all →",
    masterwork: "Masterwork selection", featured: "Featured artifacts",
  },
  "pt-BR": {
    demoBanner: "DEMONSTRAÇÃO INTERATIVA DE PORTFÓLIO · SEM COMPRAS OU PAGAMENTOS REAIS",
    armory: "Arsenal", relics: "Relíquias", potions: "Poções", admin: "Demo administrativa",
    wishlist: "Favoritos", cart: "Carrinho", menu: "Menu", language: "Idioma",
    safeDemo: "Demonstração interativa segura",
    safeDemoText: "Tudo permanece neste navegador. Nenhuma conta é criada, nenhum dado é enviado e nenhum pagamento pode ocorrer.",
    footerText: "Uma loja de fantasia totalmente interativa, criada como uma demonstração de portfólio segura e sem backend.",
    explore: "Explorar", catalog: "Catálogo", demoBehavior: "Como a demo funciona",
    demoBehaviorText: "Seu carrinho e suas alterações ficam somente no armazenamento local do navegador. Limpe-os quando quiser na demo administrativa.",
    heroBadge: "Selecionados para jornadas lendárias", heroTitle: "Equipamentos para quem atende ao chamado.",
    heroText: "Explore uma loja de fantasia feita à mão, da descoberta a um checkout totalmente simulado.",
    enterArmory: "Entrar no arsenal", exploreAdmin: "Explorar demo administrativa",
    browserOnly: "Somente no navegador", noBackend: "Sem backend ou dados pessoais",
    interactive: "Totalmente interativa", interactiveText: "Carrinho, checkout e administração",
    portfolio: "Experiência de portfólio", portfolioText: "Criada para apresentar o produto",
    choosePath: "Escolha seu caminho", shopCollection: "Compre por coleção", viewAll: "Ver tudo →",
    masterwork: "Seleção de obras-primas", featured: "Artefatos em destaque",
  },
} as const;

export type MessageKey = keyof typeof messages.en;
