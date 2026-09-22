export type Category = { slug: string; name: string; image: string; description: string };
export type Variant = { id: string; name: string; stock: number; priceCents?: number };
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

const single = (slug: string, stock: number): Variant[] => [{ id: `${slug}-standard`, name: "Standard", stock }];
const sized = (slug: string, stock: number): Variant[] => ["S", "M", "L", "XL"].map((size, index) => ({ id: `${slug}-${size.toLowerCase()}`, name: `Size ${size}`, stock: Math.max(1, stock - index * 2) }));

export const categories: Category[] = [
  { slug: "swords", name: "Swords", image: "/categories/swords.webp", description: "Blades forged for legends." },
  { slug: "shields", name: "Shields", image: "/categories/shields.webp", description: "Stand firm against any foe." },
  { slug: "armor", name: "Armor", image: "/categories/armor.webp", description: "Protection worthy of champions." },
  { slug: "cloaks", name: "Cloaks", image: "/categories/cloaks.webp", description: "Travel unseen and unweathered." },
  { slug: "relics", name: "Relics", image: "/categories/relics.webp", description: "Rare objects with older stories." },
  { slug: "potions", name: "Potions", image: "/categories/potions.webp", description: "A second chance in a small vial." },
];

export const products: Product[] = [
  { slug: "dragonbone-greatsword", name: "Dragonbone Greatsword", description: "Carved from a fallen wyrm's rib, lighter than its size suggests and slow to dull.", material: "Dragonbone", priceCents: 32000, category: "swords", image: "/products/dragonbone-greatsword-natural.webp", featured: true, variants: single("dragonbone-greatsword", 4) },
  { slug: "iron-longsword", name: "Iron Longsword", description: "A dependable double-edged blade, favored by militia and mercenaries alike.", material: "Iron", priceCents: 4500, category: "swords", image: "/products/iron-longsword.webp", variants: single("iron-longsword", 40) },
  { slug: "silver-rapier", name: "Silver Rapier", description: "A duelist's blade — fast, precise, and unusually effective against the unnatural.", material: "Silver", priceCents: 11000, category: "swords", image: "/products/silver-rapier.webp", variants: single("silver-rapier", 15) },
  { slug: "dragonscale-shield", name: "Dragonscale Shield", description: "Overlapping scale plates that shrug off flame better than steel ever could.", material: "Dragonscale", priceCents: 41000, category: "shields", image: "/products/dragonscale-shield.webp", featured: true, variants: single("dragonscale-shield", 5) },
  { slug: "oakheart-round-shield", name: "Oakheart Round Shield", description: "Bound in iron at the rim, favored by skirmishers who need to move.", material: "Oak & Iron", priceCents: 4200, category: "shields", image: "/products/oakheart-round-shield.webp", variants: single("oakheart-round-shield", 22) },
  { slug: "mithril-chestplate", name: "Mithril Chestplate", description: "Plate-grade protection at a fraction of the weight — and the price to match.", material: "Mithril", priceCents: 52000, category: "armor", image: "/products/mithril-chestplate.webp", featured: true, variants: sized("mithril-chestplate", 8) },
  { slug: "steel-great-helm", name: "Steel Great Helm", description: "Full-face coverage for the tournament yard or the front line.", material: "Steel", priceCents: 6800, category: "armor", image: "/products/steel-great-helm.webp", variants: sized("steel-great-helm", 18) },
  { slug: "shadowweave-cloak", name: "Shadowweave Cloak", description: "Woven with something that drinks torchlight rather than reflecting it.", material: "Shadowweave", priceCents: 26000, category: "cloaks", image: "/products/shadowweave-cloak.webp", featured: true, variants: sized("shadowweave-cloak", 7) },
  { slug: "travelers-cloak", name: "Traveler's Cloak", description: "Oiled wool that sheds rain and road-dust in equal measure.", material: "Wool", priceCents: 2200, category: "cloaks", image: "/products/travelers-cloak.webp", variants: sized("travelers-cloak", 30) },
  { slug: "shard-of-the-frostfall-blade", name: "Shard of the Frostfall Blade", description: "All that remains of a legendary sword — still cold enough to frost a gauntlet.", material: "Enchanted Ice", priceCents: 45000, category: "relics", image: "/products/shard-of-the-frostfall-blade.webp", featured: true, variants: single("shard-of-the-frostfall-blade", 3) },
  { slug: "amulet-of-warding", name: "Amulet of Warding", description: "A dull grey stone on a plain chain — until it flares white at danger.", material: "Warded Stone", priceCents: 21000, category: "relics", image: "/products/amulet-of-warding.webp", variants: single("amulet-of-warding", 9) },
  { slug: "greater-healing-potion", name: "Greater Healing Potion", description: "Mends deep wounds fast enough to get you back on your feet mid-brawl.", material: "Herbal Tincture", priceCents: 2600, category: "potions", image: "/products/greater-healing-potion.webp", variants: single("greater-healing-potion", 60) },
  { slug: "potion-of-giant-strength", name: "Potion of Giant Strength", description: "Ten minutes of strength you did not have ten minutes ago.", material: "Alchemical Brew", priceCents: 3200, category: "potions", image: "/products/potion-of-giant-strength.webp", variants: single("potion-of-giant-strength", 30) },
];

export const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export const findProduct = (slug: string) => products.find((product) => product.slug === slug);
export const findVariant = (variantId: string) => products.flatMap((product) => product.variants.map((variant) => ({ product, variant }))).find(({ variant }) => variant.id === variantId);
