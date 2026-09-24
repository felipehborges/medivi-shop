export type Category = {
  slug: string;
  name: string;
  image: string;
  description: string;
};
export type Variant = {
  id: string;
  name: string;
  stock: number;
  priceCents?: number;
};
export type Product = {
  slug: string;
  name: string;
  description: string;
  material: string;
  priceCents: number;
  category: string;
  image: string;
  featured?: boolean;
  variants: Variant[];
};

const single = (slug: string, stock: number): Variant[] => [
  { id: `${slug}-standard`, name: "Standard", stock },
];
const sized = (slug: string, stock: number): Variant[] =>
  ["S", "M", "L", "XL"].map((size, index) => ({
    id: `${slug}-${size.toLowerCase()}`,
    name: `Size ${size}`,
    stock: Math.max(1, stock - index * 2),
  }));

export const categories: Category[] = [
  {
    slug: "swords",
    name: "Swords",
    image: "/categories/swords.webp",
    description: "Blades forged for legends.",
  },
  {
    slug: "shields",
    name: "Shields",
    image: "/categories/shields.webp",
    description: "Stand firm against any foe.",
  },
  {
    slug: "armor",
    name: "Armor",
    image: "/categories/armor.webp",
    description: "Protection worthy of champions.",
  },
  {
    slug: "cloaks",
    name: "Cloaks",
    image: "/categories/cloaks.webp",
    description: "Travel unseen and unweathered.",
  },
  {
    slug: "relics",
    name: "Relics",
    image: "/categories/relics.webp",
    description: "Rare objects with older stories.",
  },
  {
    slug: "potions",
    name: "Potions",
    image: "/categories/potions.webp",
    description: "A second chance in a small vial.",
  },
];

export const products: Product[] = [
  {
    slug: "dragonbone-greatsword",
    name: "Dragonbone Greatsword",
    description:
      "Carved from a fallen wyrm's rib, lighter than its size suggests and slow to dull.",
    material: "Dragonbone",
    priceCents: 32000,
    category: "swords",
    image: "/products/dragonbone-greatsword.webp",
    featured: true,
    variants: single("dragonbone-greatsword", 4),
  },
  {
    slug: "iron-longsword",
    name: "Iron Longsword",
    description:
      "A dependable double-edged blade, favored by militia and mercenaries alike.",
    material: "Iron",
    priceCents: 4500,
    category: "swords",
    image: "/products/iron-longsword.webp",
    variants: single("iron-longsword", 40),
  },
  {
    slug: "silver-rapier",
    name: "Silver Rapier",
    description:
      "A duelist's blade — fast, precise, and unusually effective against the unnatural.",
    material: "Silver",
    priceCents: 11000,
    category: "swords",
    image: "/products/silver-rapier.webp",
    variants: single("silver-rapier", 15),
  },
  {
    slug: "dragonscale-shield",
    name: "Dragonscale Shield",
    description:
      "Overlapping scale plates that shrug off flame better than steel ever could.",
    material: "Dragonscale",
    priceCents: 41000,
    category: "shields",
    image: "/products/dragonscale-shield.webp",
    featured: true,
    variants: single("dragonscale-shield", 5),
  },
  {
    slug: "oakheart-round-shield",
    name: "Oakheart Round Shield",
    description:
      "Bound in iron at the rim, favored by skirmishers who need to move.",
    material: "Oak & Iron",
    priceCents: 4200,
    category: "shields",
    image: "/products/oakheart-round-shield.webp",
    variants: single("oakheart-round-shield", 22),
  },
  {
    slug: "mithril-chestplate",
    name: "Mithril Chestplate",
    description:
      "Plate-grade protection at a fraction of the weight — and the price to match.",
    material: "Mithril",
    priceCents: 52000,
    category: "armor",
    image: "/products/mithril-chestplate.webp",
    featured: true,
    variants: sized("mithril-chestplate", 8),
  },
  {
    slug: "steel-great-helm",
    name: "Steel Great Helm",
    description:
      "Full-face coverage for the tournament yard or the front line.",
    material: "Steel",
    priceCents: 6800,
    category: "armor",
    image: "/products/steel-great-helm.webp",
    variants: sized("steel-great-helm", 18),
  },
  {
    slug: "shadowweave-cloak",
    name: "Shadowweave Cloak",
    description:
      "Woven with something that drinks torchlight rather than reflecting it.",
    material: "Shadowweave",
    priceCents: 26000,
    category: "cloaks",
    image: "/products/shadowweave-cloak.webp",
    featured: true,
    variants: sized("shadowweave-cloak", 7),
  },
  {
    slug: "travelers-cloak",
    name: "Traveler's Cloak",
    description: "Oiled wool that sheds rain and road-dust in equal measure.",
    material: "Wool",
    priceCents: 2200,
    category: "cloaks",
    image: "/products/travelers-cloak.webp",
    variants: sized("travelers-cloak", 30),
  },
  {
    slug: "shard-of-the-frostfall-blade",
    name: "Shard of the Frostfall Blade",
    description:
      "All that remains of a legendary sword — still cold enough to frost a gauntlet.",
    material: "Enchanted Ice",
    priceCents: 45000,
    category: "relics",
    image: "/products/shard-of-the-frostfall-blade.webp",
    featured: true,
    variants: single("shard-of-the-frostfall-blade", 3),
  },
  {
    slug: "amulet-of-warding",
    name: "Amulet of Warding",
    description:
      "A dull grey stone on a plain chain — until it flares white at danger.",
    material: "Warded Stone",
    priceCents: 21000,
    category: "relics",
    image: "/products/amulet-of-warding.webp",
    variants: single("amulet-of-warding", 9),
  },
  {
    slug: "greater-healing-potion",
    name: "Greater Healing Potion",
    description:
      "Mends deep wounds fast enough to get you back on your feet mid-brawl.",
    material: "Herbal Tincture",
    priceCents: 2600,
    category: "potions",
    image: "/products/greater-healing-potion.webp",
    variants: single("greater-healing-potion", 60),
  },
  {
    slug: "potion-of-giant-strength",
    name: "Potion of Giant Strength",
    description: "Ten minutes of strength you did not have ten minutes ago.",
    material: "Alchemical Brew",
    priceCents: 3200,
    category: "potions",
    image: "/products/potion-of-giant-strength.webp",
    variants: single("potion-of-giant-strength", 30),
  },
];

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export const findProduct = (slug: string) =>
  products.find((product) => product.slug === slug);
export const findVariant = (variantId: string) =>
  products
    .flatMap((product) =>
      product.variants.map((variant) => ({ product, variant })),
    )
    .find(({ variant }) => variant.id === variantId);

// Approved fictional provenance from the Medivi Armory design reference.
export const artifactRecords = [
  {
    slug: "dragonbone-greatsword",
    dept: "armory",
    priceCents: 32000,
    stock: 4,
    rar: 4,
    en: {
      name: "Dragonbone Greatsword",
      material: "Dragonbone",
      origin: "The Hollow, beyond Vael",
      era: "Age of Ash",
      weight: "9 stone",
      maker: "Odran Blackhand",
      makerNote: "Ironmark Guild, third seal",
      description:
        "Carved from a fallen wyrm's rib, lighter than its size suggests and slow to dull.",
      note: "Three returned from the Hollow carrying these. Only one still spoke, and he would not say what he had seen.",
    },
    pt: {
      name: "Espadão de Osso de Dragão",
      material: "Osso de dragão",
      origin: "O Vazio, além de Vael",
      era: "Era das Cinzas",
      weight: "9 arrobas",
      maker: "Odran Mão-Negra",
      makerNote: "Guilda de Ironmark, terceiro selo",
      description:
        "Esculpido na costela de um dragão caído, mais leve do que parece e difícil de perder o fio.",
      note: "Três voltaram do Vazio carregando estes. Só um ainda falava, e não dizia o que tinha visto.",
    },
  },
  {
    slug: "shard-of-the-frostfall-blade",
    dept: "relics",
    priceCents: 45000,
    stock: 3,
    rar: 5,
    en: {
      name: "Shard of the Frostfall Blade",
      material: "Enchanted Ice",
      origin: "Northern Marches",
      era: "Before the Long Winter",
      weight: "2 stone",
      maker: "Unknown hand",
      makerNote: "No guild claims it",
      description:
        "All that remains of a legendary sword — still cold enough to frost a gauntlet.",
      note: "It has not melted in eleven years under my roof. I keep it in the cold room regardless.",
    },
    pt: {
      name: "Fragmento da Lâmina Glacial",
      material: "Gelo encantado",
      origin: "Marcas do Norte",
      era: "Antes do Longo Inverno",
      weight: "2 arrobas",
      maker: "Mão desconhecida",
      makerNote: "Nenhuma guilda o reivindica",
      description:
        "O que resta de uma espada lendária, ainda fria o bastante para congelar uma manopla.",
      note: "Não derreteu em onze anos sob meu teto. Ainda assim, guardo-o na câmara fria.",
    },
  },
  {
    slug: "mithril-chestplate",
    dept: "bulwark",
    priceCents: 52000,
    stock: 8,
    rar: 4,
    en: {
      name: "Mithril Chestplate",
      material: "Mithril",
      origin: "Ironmark",
      era: "Third Age of Aster",
      weight: "4 stone",
      maker: "Maera of Greyfen",
      makerNote: "Master of the plate benches",
      description:
        "Plate-grade protection at a fraction of the weight — and the price to match.",
      note: "Maera will not sell two in the same season. This is the season's.",
    },
    pt: {
      name: "Peitoral de Mithril",
      material: "Mithril",
      origin: "Ironmark",
      era: "Terceira Era de Aster",
      weight: "4 arrobas",
      maker: "Maera de Greyfen",
      makerNote: "Mestra das bancadas de armadura",
      description:
        "Proteção de armadura pesada com uma fração do peso e um preço à altura.",
      note: "Maera não vende dois na mesma estação. Este é o desta.",
    },
  },
  {
    slug: "dragonscale-shield",
    dept: "bulwark",
    priceCents: 41000,
    stock: 5,
    rar: 4,
    en: {
      name: "Dragonscale Shield",
      material: "Dragonscale",
      origin: "Ashfell",
      era: "Age of Embers",
      weight: "7 stone",
      maker: "Hadrik Ost",
      makerNote: "Scale-binder of Ashfell",
      description:
        "Overlapping scale plates that shrug off flame better than steel ever could.",
      note: "Held against forge-fire for a count of forty. The hand behind it stayed cool.",
    },
    pt: {
      name: "Escudo de Escamas de Dragão",
      material: "Escamas de dragão",
      origin: "Ashfell",
      era: "Era das Brasas",
      weight: "7 arrobas",
      maker: "Hadrik Ost",
      makerNote: "Encaixador de escamas de Ashfell",
      description:
        "Placas de escamas sobrepostas que resistem às chamas melhor do que o aço.",
      note: "Mantido contra o fogo da forja por quarenta contagens. A mão atrás dele ficou fria.",
    },
  },
  {
    slug: "shadowweave-cloak",
    dept: "wayfarer",
    priceCents: 26000,
    stock: 7,
    rar: 3,
    en: {
      name: "Shadowweave Cloak",
      material: "Shadowweave",
      origin: "Greyfen looms",
      era: "Third Age of Aster",
      weight: "half a stone",
      maker: "Sister Ilveth",
      makerNote: "Of the Grey Hand",
      description:
        "Woven with something that drinks torchlight rather than reflecting it.",
      note: "Do not ask what the thread is. Ilveth answers that question only once per customer.",
    },
    pt: {
      name: "Capa de Trama Sombria",
      material: "Trama sombria",
      origin: "Teares de Greyfen",
      era: "Terceira Era de Aster",
      weight: "meia arroba",
      maker: "Irmã Ilveth",
      makerNote: "Da Mão Cinzenta",
      description:
        "Tecida com um material que absorve a luz das tochas em vez de refleti-la.",
      note: "Não pergunte de que é o fio. Ilveth responde isso uma vez por cliente.",
    },
  },
  {
    slug: "amulet-of-warding",
    dept: "relics",
    priceCents: 21000,
    stock: 9,
    rar: 3,
    en: {
      name: "Amulet of Warding",
      material: "Warded Stone",
      origin: "Sunken Coast",
      era: "Age of Chains",
      weight: "a few ounces",
      maker: "Brother Anselm",
      makerNote: "Ward-cutter, Order of the Grey Hand",
      description:
        "A dull grey stone on a plain chain — until it flares white at danger.",
      note: "Flared twice on the road here. Both times before the dogs noticed anything.",
    },
    pt: {
      name: "Amuleto de Proteção",
      material: "Pedra protegida",
      origin: "Costa Submersa",
      era: "Era das Correntes",
      weight: "algumas onças",
      maker: "Irmão Anselm",
      makerNote: "Talhador de proteções, Ordem da Mão Cinzenta",
      description:
        "Uma pedra cinza numa corrente simples que brilha em branco diante do perigo.",
      note: "Brilhou duas vezes na estrada até aqui. Nas duas, antes dos cães perceberem algo.",
    },
  },
  {
    slug: "silver-rapier",
    dept: "armory",
    priceCents: 11000,
    stock: 15,
    rar: 3,
    en: {
      name: "Silver Rapier",
      material: "Silver",
      origin: "Low Quarter of Vael",
      era: "Third Age of Aster",
      weight: "2 stone",
      maker: "Torvald Quen",
      makerNote: "Duelling smith, two seals",
      description:
        "A duelist's blade — fast, precise, and unusually effective against the unnatural.",
      note: "Quen files the edge thin. Bring it back to him, not to me.",
    },
    pt: {
      name: "Florete de Prata",
      material: "Prata",
      origin: "Bairro Baixo de Vael",
      era: "Terceira Era de Aster",
      weight: "2 arrobas",
      maker: "Torvald Quen",
      makerNote: "Ferreiro de duelo, dois selos",
      description:
        "Uma lâmina de duelista: rápida, precisa e especialmente eficaz contra o sobrenatural.",
      note: "Quen deixa o fio fino. Leve-o de volta a ele, não a mim.",
    },
  },
  {
    slug: "steel-great-helm",
    dept: "bulwark",
    priceCents: 6800,
    stock: 18,
    rar: 2,
    en: {
      name: "Steel Great Helm",
      material: "Steel",
      origin: "Ironmark",
      era: "Third Age of Aster",
      weight: "3 stone",
      maker: "Ironmark benches",
      makerNote: "Guild-marked, common run",
      description:
        "Full-face coverage for the tournament yard or the front line.",
      note: "Sized to four heads. Try them in the yard before you ride.",
    },
    pt: {
      name: "Elmo Pesado de Aço",
      material: "Aço",
      origin: "Ironmark",
      era: "Terceira Era de Aster",
      weight: "3 arrobas",
      maker: "Bancadas de Ironmark",
      makerNote: "Marca da guilda, série comum",
      description:
        "Proteção completa para o rosto, ideal para torneios ou a linha de frente.",
      note: "Vem em quatro tamanhos. Experimente no pátio antes de partir.",
    },
  },
  {
    slug: "iron-longsword",
    dept: "armory",
    priceCents: 4500,
    stock: 40,
    rar: 1,
    en: {
      name: "Iron Longsword",
      material: "Iron",
      origin: "Ironmark",
      era: "Third Age of Aster",
      weight: "3 stone",
      maker: "Ironmark benches",
      makerNote: "Common run, guild-marked",
      description:
        "A dependable double-edged blade, favored by militia and mercenaries alike.",
      note: "Forty in the rack. Nobody has returned one yet.",
    },
    pt: {
      name: "Espada Longa de Ferro",
      material: "Ferro",
      origin: "Ironmark",
      era: "Terceira Era de Aster",
      weight: "3 arrobas",
      maker: "Bancadas de Ironmark",
      makerNote: "Série comum, marca da guilda",
      description:
        "Uma lâmina confiável de dois gumes, apreciada por milícias e mercenários.",
      note: "Quarenta no suporte. Ninguém devolveu nenhuma ainda.",
    },
  },
  {
    slug: "oakheart-round-shield",
    dept: "bulwark",
    priceCents: 4200,
    stock: 22,
    rar: 1,
    en: {
      name: "Oakheart Round Shield",
      material: "Oak & Iron",
      origin: "Vale of Caerwyn",
      era: "Third Age of Aster",
      weight: "4 stone",
      maker: "Wren Calloway",
      makerNote: "Shieldwright of Caerwyn",
      description:
        "Bound in iron at the rim, favored by skirmishers who need to move.",
      note: "Light enough to run with. Wren rims them herself.",
    },
    pt: {
      name: "Escudo Redondo de Carvalho",
      material: "Carvalho e ferro",
      origin: "Vale de Caerwyn",
      era: "Terceira Era de Aster",
      weight: "4 arrobas",
      maker: "Wren Calloway",
      makerNote: "Escudeira de Caerwyn",
      description:
        "Reforçado com ferro na borda, preferido por combatentes que precisam de mobilidade.",
      note: "Leve o bastante para correr. Wren faz as bordas ela mesma.",
    },
  },
  {
    slug: "travelers-cloak",
    dept: "wayfarer",
    priceCents: 2200,
    stock: 30,
    rar: 1,
    en: {
      name: "Traveler's Cloak",
      material: "Wool",
      origin: "Greyfen looms",
      era: "Third Age of Aster",
      weight: "half a stone",
      maker: "Greyfen weavers",
      makerNote: "Oiled by the bolt",
      description: "Oiled wool that sheds rain and road-dust in equal measure.",
      note: "The cheapest thing in the shop that will actually keep you alive.",
    },
    pt: {
      name: "Capa de Viajante",
      material: "Lã",
      origin: "Teares de Greyfen",
      era: "Terceira Era de Aster",
      weight: "meia arroba",
      maker: "Tecelãs de Greyfen",
      makerNote: "Enceradas por rolo",
      description:
        "Lã encerada que repele tanto a chuva quanto a poeira da estrada.",
      note: "A coisa mais barata da loja que de fato mantém você vivo.",
    },
  },
  {
    slug: "greater-healing-potion",
    dept: "alchemist",
    priceCents: 2600,
    stock: 60,
    rar: 2,
    en: {
      name: "Greater Healing Potion",
      material: "Herbal Tincture",
      origin: "Ashfell Apothecary",
      era: "Brewed this season",
      weight: "a flask",
      maker: "The Ashfell coven",
      makerNote: "Sealed with green wax",
      description:
        "Mends deep wounds fast enough to get you back on your feet mid-brawl.",
      note: "Drink it standing. Those who drink it lying down tend to stay there.",
    },
    pt: {
      name: "Poção de Cura Maior",
      material: "Tintura de ervas",
      origin: "Boticário de Ashfell",
      era: "Preparada nesta estação",
      weight: "um frasco",
      maker: "O coven de Ashfell",
      makerNote: "Selada com cera verde",
      description: "Cura ferimentos profundos a tempo de você voltar à luta.",
      note: "Beba de pé. Quem bebe deitado costuma continuar deitado.",
    },
  },
  {
    slug: "potion-of-giant-strength",
    dept: "alchemist",
    priceCents: 3200,
    stock: 30,
    rar: 2,
    en: {
      name: "Potion of Giant Strength",
      material: "Alchemical Brew",
      origin: "Ashfell Apothecary",
      era: "Brewed this season",
      weight: "a flask",
      maker: "The Ashfell coven",
      makerNote: "Sealed with red wax",
      description: "Ten minutes of strength you did not have ten minutes ago.",
      note: "Ten minutes, no more. Count them, and be somewhere safe when you finish.",
    },
    pt: {
      name: "Poção de Força Gigante",
      material: "Preparado alquímico",
      origin: "Boticário de Ashfell",
      era: "Preparada nesta estação",
      weight: "um frasco",
      maker: "O coven de Ashfell",
      makerNote: "Selada com cera vermelha",
      description:
        "Dez minutos de uma força que você não tinha dez minutos atrás.",
      note: "Dez minutos, não mais. Conte-os e esteja em lugar seguro ao terminar.",
    },
  },
];
export const departments = [
  {
    slug: "armory",
    mark: "broadsword",
    en: {
      name: "The Armory",
      description: "Blades and edged work, from militia iron to the rare.",
    },
    pt: {
      name: "O Arsenal",
      description: "Lâminas e trabalho de fio, do ferro de milícia ao raro.",
    },
  },
  {
    slug: "bulwark",
    mark: "shield",
    en: {
      name: "The Bulwark",
      description:
        "Shields, plate and helms. What stands between you and the swing.",
    },
    pt: {
      name: "O Baluarte",
      description:
        "Escudos, armaduras e elmos. O que fica entre você e o golpe.",
    },
  },
  {
    slug: "wayfarer",
    mark: "cloak",
    en: {
      name: "Wayfarer Goods",
      description: "Cloaks and road cloth for weather, dust and long distance.",
    },
    pt: {
      name: "Bens de Viajante",
      description:
        "Capas e tecidos de estrada para clima, poeira e longas distâncias.",
    },
  },
  {
    slug: "relics",
    mark: "rune",
    en: {
      name: "Relics",
      description:
        "Objects of uncertain origin. Sold as found, priced as rare.",
    },
    pt: {
      name: "Relíquias",
      description:
        "Objetos de origem incerta. Vendidos como achados, cobrados como raros.",
    },
  },
  {
    slug: "alchemist",
    mark: "potion",
    en: {
      name: "Alchemist's Shelf",
      description:
        "Tinctures and brews from the Ashfell benches, sealed in wax.",
    },
    pt: {
      name: "Prateleira do Alquimista",
      description:
        "Tinturas e preparados das bancadas de Ashfell, selados em cera.",
    },
  },
];
export const rarityLabels = {
  en: ["", "Common ware", "Guild-marked", "Rare", "Relic", "Legend"],
  pt: ["", "Artigo comum", "Marca da guilda", "Raro", "Relíquia", "Lenda"],
};
export const findRecord = (slug: string) =>
  artifactRecords.find((record) => record.slug === slug);
