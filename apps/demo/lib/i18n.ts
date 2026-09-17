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

// Copy used throughout the interactive demo. Keeping the English phrase as the
// key makes missing translations visible during review.
export const demoCopy: Record<string, string> = {
  "The complete collection": "A coleção completa", "Adventure awaits": "A aventura espera por você", "Search and filter the catalog. All inventory is demonstration data.": "Busque e filtre o catálogo. Todo o estoque é fictício.",
  "Search": "Buscar", "Sword, mithril...": "Espada, mithril...", "Collection": "Coleção", "All items": "Todos os itens", "artifacts": "artefatos", "Sort products": "Ordenar produtos", "Featured first": "Destaques primeiro", "Price: low to high": "Preço: menor para maior", "Price: high to low": "Preço: maior para menor", "No artifacts found": "Nenhum artefato encontrado", "Try another search or collection.": "Tente outra busca ou coleção.",
  "Remove from wishlist": "Remover dos favoritos", "Add to wishlist": "Adicionar aos favoritos", "Featured": "Destaque", "Back to the armory": "Voltar ao arsenal", "Choose a variant": "Escolha uma variante", "available in demo inventory": "disponíveis no estoque da demo", "Add to cart": "Adicionar ao carrinho", "Toggle wishlist": "Alternar favorito", "Demo interaction.": "Interação de demonstração.", "This selection is stored only in your browser and cannot create a real purchase.": "Esta seleção fica apenas no seu navegador e não gera uma compra real.", "You may also seek": "Você também pode gostar de",
  "Your satchel is empty": "Sua bolsa está vazia", "The armory is stocked with everything your next quest needs.": "O arsenal tem tudo para sua próxima missão.", "Explore the catalog": "Explorar o catálogo", "Your cart": "Seu carrinho", "A browser-local preview of the purchase experience.": "Uma prévia da compra armazenada neste navegador.", "Remove item": "Remover item", "Decrease quantity": "Diminuir quantidade", "Increase quantity": "Aumentar quantidade", "Order preview": "Resumo do pedido", "Subtotal": "Subtotal", "Demo shipping": "Frete da demo", "Free": "Grátis", "Total": "Total", "Continue to checkout": "Continuar para o checkout",
  "Your cart is empty": "Seu carrinho está vazio", "Return to catalog": "Voltar ao catálogo", "Demonstration checkout": "Checkout de demonstração", "Contact": "Contato", "Use fictional information. It never leaves your browser.": "Use dados fictícios. Eles não saem do seu navegador.", "Email": "E-mail", "Full name": "Nome completo", "Address": "Endereço", "City": "Cidade", "Postal code": "CEP", "Summary": "Resumo", "items": "itens", "Continue to simulation": "Continuar para a simulação", "No card details will be requested.": "Nenhum dado de cartão será solicitado.",
  "No pending demo checkout": "Nenhum checkout pendente na demo", "Browse catalog": "Explorar catálogo", "Simulated payment": "Pagamento simulado", "Choose an outcome to preview the storefront response.": "Escolha um resultado para ver a resposta da loja.", "Demo total": "Total da demo", "NO CHARGE": "SEM COBRANÇA", "Payment simulation declined.": "Pagamento simulado recusado.", "Your cart was preserved. Choose approval to continue.": "Seu carrinho foi preservado. Escolha aprovar para continuar.", "Simulate decline": "Simular recusa", "Simulate approval": "Simular aprovação", "This interface intentionally collects no card number, security code, or billing credential.": "Esta interface não coleta número de cartão, código de segurança nem dados de cobrança.",
  "Demo order not found": "Pedido da demo não encontrado", "Browser-local orders disappear when demo data is reset.": "Os pedidos locais desaparecem quando os dados da demo são redefinidos.", "Simulation approved": "Simulação aprovada", "Your quest is confirmed": "Sua missão está confirmada", "No payment was made and no email was sent. This order exists only in this browser.": "Nenhum pagamento foi feito e nenhum e-mail foi enviado. Este pedido existe apenas neste navegador.", "Demo order": "Pedido da demo", "Display email": "E-mail exibido", "Simulated total": "Total simulado", "Continue exploring": "Continuar explorando", "View demo operations": "Ver operações da demo",
  "Wishlist": "Favoritos", "Saved only on this device.": "Salvos apenas neste dispositivo.", "No favorites yet": "Ainda não há favoritos", "Find an artifact": "Encontrar um artefato",
  "Demo products": "Produtos da demo", "Cart value": "Valor do carrinho", "Local orders": "Pedidos locais", "LOCAL DEMO": "DEMO LOCAL", "No shared changes": "Alterações não compartilhadas", "Merchant command center": "Painel do lojista", "Preview operational UI safely with browser-local state.": "Explore o painel com segurança usando dados locais do navegador.", "View storefront": "Ver loja", "Restore defaults": "Restaurar padrões", "Catalog visibility": "Visibilidade do catálogo", "Changes appear only in this browser.": "As alterações aparecem apenas neste navegador.", "Hidden": "Oculto", "Visible": "Visível", "Show": "Mostrar", "Hide": "Ocultar", "Recent demo orders": "Pedidos recentes da demo", "Simulated paid": "Pagamento simulado", "lines": "linhas", "Complete the checkout simulation to populate this panel.": "Conclua a simulação de checkout para preencher este painel.", "Commercial version preserved": "Versão comercial preservada", "The real database, authentication, payments, email, storage and audit implementation remain in": "O banco de dados, a autenticação, os pagamentos, os e-mails, o armazenamento e a auditoria reais permanecem em", "This portfolio app does not import them.": "Esta demo de portfólio não usa esses recursos.",
  "Medivi home": "Página inicial da Medivi",
  "404 · Lost realm": "404 · Reino perdido", "This path is not on the map": "Este caminho não está no mapa", "Return home": "Voltar ao início",
  "Opening the armory…": "Abrindo o arsenal…", "Loading demo order…": "Carregando pedido da demo…",
  "Swords": "Espadas", "Shields": "Escudos", "Armor": "Armaduras", "Cloaks": "Capas", "Relics": "Relíquias", "Potions": "Poções",
  "Blades forged for legends.": "Lâminas forjadas para lendas.", "Stand firm against any foe.": "Resista a qualquer inimigo.", "Protection worthy of champions.": "Proteção digna de campeões.", "Travel unseen and unweathered.": "Viaje sem ser visto e protegido das intempéries.", "Rare objects with older stories.": "Objetos raros com histórias antigas.", "A second chance in a small vial.": "Uma segunda chance em um pequeno frasco.",
  "Dragonbone Greatsword": "Espadão de Osso de Dragão", "Iron Longsword": "Espada Longa de Ferro", "Silver Rapier": "Florete de Prata", "Dragonscale Shield": "Escudo de Escamas de Dragão", "Oakheart Round Shield": "Escudo Redondo de Carvalho", "Mithril Chestplate": "Peitoral de Mithril", "Steel Great Helm": "Elmo Pesado de Aço", "Shadowweave Cloak": "Capa de Trama Sombria", "Traveler's Cloak": "Capa de Viajante", "Shard of the Frostfall Blade": "Fragmento da Lâmina Glacial", "Amulet of Warding": "Amuleto de Proteção", "Greater Healing Potion": "Poção de Cura Maior", "Potion of Giant Strength": "Poção de Força Gigante",
  "Dragonbone": "Osso de dragão", "Iron": "Ferro", "Silver": "Prata", "Dragonscale": "Escamas de dragão", "Oak & Iron": "Carvalho e ferro", "Mithril": "Mithril", "Steel": "Aço", "Shadowweave": "Trama sombria", "Wool": "Lã", "Enchanted Ice": "Gelo encantado", "Warded Stone": "Pedra protegida", "Herbal Tincture": "Tintura de ervas", "Alchemical Brew": "Preparado alquímico", "Standard": "Padrão", "Size S": "Tamanho P", "Size M": "Tamanho M", "Size L": "Tamanho G", "Size XL": "Tamanho GG",
  "Carved from a fallen wyrm's rib, lighter than its size suggests and slow to dull.": "Esculpido na costela de um dragão caído, mais leve do que parece e difícil de perder o fio.",
  "A dependable double-edged blade, favored by militia and mercenaries alike.": "Uma lâmina confiável de dois gumes, apreciada por milícias e mercenários.",
  "A duelist's blade — fast, precise, and unusually effective against the unnatural.": "Uma lâmina de duelista: rápida, precisa e especialmente eficaz contra o sobrenatural.",
  "Overlapping scale plates that shrug off flame better than steel ever could.": "Placas de escamas sobrepostas que resistem às chamas melhor do que o aço.",
  "Bound in iron at the rim, favored by skirmishers who need to move.": "Reforçado com ferro na borda, preferido por combatentes que precisam de mobilidade.",
  "Plate-grade protection at a fraction of the weight — and the price to match.": "Proteção de armadura pesada com uma fração do peso e um preço à altura.",
  "Full-face coverage for the tournament yard or the front line.": "Proteção completa para o rosto, ideal para torneios ou a linha de frente.",
  "Woven with something that drinks torchlight rather than reflecting it.": "Tecida com um material que absorve a luz das tochas em vez de refleti-la.",
  "Oiled wool that sheds rain and road-dust in equal measure.": "Lã encerada que repele tanto a chuva quanto a poeira da estrada.",
  "All that remains of a legendary sword — still cold enough to frost a gauntlet.": "O que resta de uma espada lendária, ainda fria o bastante para congelar uma manopla.",
  "A dull grey stone on a plain chain — until it flares white at danger.": "Uma pedra cinza numa corrente simples que brilha em branco diante do perigo.",
  "Mends deep wounds fast enough to get you back on your feet mid-brawl.": "Cura ferimentos profundos a tempo de você voltar à luta.",
  "Ten minutes of strength you did not have ten minutes ago.": "Dez minutos de uma força que você não tinha dez minutos atrás.",
};

export function translateDemo(locale: Locale, text: string): string {
  return locale === "pt-BR" ? demoCopy[text] ?? text : text;
}
