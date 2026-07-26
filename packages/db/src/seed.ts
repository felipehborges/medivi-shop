import { db } from "./client";
import { category, product, productImage, productVariant, user } from "./schema";

function placeholderImage(seed: string) {
  return `https://picsum.photos/seed/${seed}/800/800`;
}

type VariantSeed = {
  name: string;
  sku: string;
  stock: number;
  priceOverrideCents?: number;
  attributes?: Record<string, string>;
};

type ProductSeed = {
  name: string;
  slug: string;
  description: string;
  material: string;
  basePriceCents: number;
  categorySlug: string;
  variants: VariantSeed[];
  isFeatured?: boolean;
};

function sizeVariants(
  sku: string,
  stocks: [number, number, number, number],
): VariantSeed[] {
  const [s, m, l, xl] = stocks;
  const stockBySize = { S: s, M: m, L: l, XL: xl };
  return (["S", "M", "L", "XL"] as const).map((size) => ({
    name: `Size: ${size}`,
    sku: `${sku}-${size}`,
    stock: stockBySize[size],
    attributes: { size },
  }));
}

function singleVariant(sku: string, stock: number): VariantSeed[] {
  return [{ name: "Standard", sku, stock }];
}

function first<T>(rows: T[], what: string): T {
  const row = rows[0];
  if (!row) throw new Error(`Expected at least one row for: ${what}`);
  return row;
}

const CATEGORIES = [
  { name: "Swords", slug: "swords" },
  { name: "Shields", slug: "shields" },
  { name: "Armor", slug: "armor" },
  { name: "Helmets", slug: "helmets", parentSlug: "armor" },
  { name: "Chestplates", slug: "chestplates", parentSlug: "armor" },
  { name: "Cloaks", slug: "cloaks" },
  { name: "Relics", slug: "relics" },
  { name: "Potions", slug: "potions" },
  { name: "Banners", slug: "banners" },
] as const;

const PRODUCTS: ProductSeed[] = [
  // --- Swords ---
  {
    name: "Iron Longsword",
    slug: "iron-longsword",
    description: "A dependable double-edged blade, favored by militia and mercenaries alike.",
    material: "Iron",
    basePriceCents: 4500,
    categorySlug: "swords",
    variants: singleVariant("SWD-IRON-LNG", 40),
  },
  {
    name: "Steel Broadsword",
    slug: "steel-broadsword",
    description: "Heavier than a longsword, built to cleave through mail and morale alike.",
    material: "Steel",
    basePriceCents: 7200,
    categorySlug: "swords",
    variants: singleVariant("SWD-STL-BRD", 25),
  },
  {
    name: "Silver Rapier",
    slug: "silver-rapier",
    description: "A duelist's blade — fast, precise, and unusually effective against the unnatural.",
    material: "Silver",
    basePriceCents: 11000,
    categorySlug: "swords",
    variants: singleVariant("SWD-SLV-RPR", 15),
  },
  {
    name: "Twin Fang Daggers",
    slug: "twin-fang-daggers",
    description: "A matched pair, balanced for throwing or close-quarters work.",
    material: "Steel",
    basePriceCents: 6000,
    categorySlug: "swords",
    variants: singleVariant("SWD-STL-DGR", 30),
  },
  {
    name: "Dragonbone Greatsword",
    slug: "dragonbone-greatsword",
    description: "Carved from a fallen wyrm's rib, lighter than its size suggests and slow to dull.",
    material: "Dragonbone",
    basePriceCents: 32000,
    categorySlug: "swords",
    variants: singleVariant("SWD-DRG-GRT", 4),
    isFeatured: true,
  },
  {
    name: "Mithril Shortsword",
    slug: "mithril-shortsword",
    description: "Featherlight and quick to answer, prized by scouts who travel far and fast.",
    material: "Mithril",
    basePriceCents: 28000,
    categorySlug: "swords",
    variants: singleVariant("SWD-MTH-SRT", 6),
  },

  // --- Shields ---
  {
    name: "Wooden Buckler",
    slug: "wooden-buckler",
    description: "Small, light, and easy to strap on — a first shield for a first adventure.",
    material: "Oak",
    basePriceCents: 1800,
    categorySlug: "shields",
    variants: singleVariant("SHD-WD-BCK", 50),
  },
  {
    name: "Iron Kite Shield",
    slug: "iron-kite-shield",
    description: "Full-body coverage on foot or horseback, standard issue for guild guards.",
    material: "Iron",
    basePriceCents: 5200,
    categorySlug: "shields",
    variants: singleVariant("SHD-IRN-KIT", 28),
  },
  {
    name: "Steel Tower Shield",
    slug: "steel-tower-shield",
    description: "Heavy enough to brace a siege line, awkward everywhere else.",
    material: "Steel",
    basePriceCents: 8900,
    categorySlug: "shields",
    variants: singleVariant("SHD-STL-TWR", 12),
  },
  {
    name: "Oakheart Round Shield",
    slug: "oakheart-round-shield",
    description: "Bound in iron at the rim, favored by skirmishers who need to move.",
    material: "Oak & Iron",
    basePriceCents: 4200,
    categorySlug: "shields",
    variants: singleVariant("SHD-OAK-RND", 22),
  },
  {
    name: "Dragonscale Shield",
    slug: "dragonscale-shield",
    description: "Overlapping scale plates that shrug off flame better than steel ever could.",
    material: "Dragonscale",
    basePriceCents: 41000,
    categorySlug: "shields",
    variants: singleVariant("SHD-DRG-SCL", 5),
    isFeatured: true,
  },

  // --- Helmets ---
  {
    name: "Leather Cap",
    slug: "leather-cap",
    description: "Boiled leather, stitched snug — better than nothing, worse than a helm.",
    material: "Leather",
    basePriceCents: 1200,
    categorySlug: "helmets",
    variants: sizeVariants("HLM-LTH-CAP", [30, 40, 40, 20]),
  },
  {
    name: "Iron Helm",
    slug: "iron-helm",
    description: "An open-faced helm balancing protection with a clear line of sight.",
    material: "Iron",
    basePriceCents: 3400,
    categorySlug: "helmets",
    variants: sizeVariants("HLM-IRN-STD", [20, 30, 30, 15]),
  },
  {
    name: "Steel Great Helm",
    slug: "steel-great-helm",
    description: "Full-face coverage for the tournament yard or the front line.",
    material: "Steel",
    basePriceCents: 6800,
    categorySlug: "helmets",
    variants: sizeVariants("HLM-STL-GRT", [10, 18, 18, 8]),
  },
  {
    name: "Dragonscale Helm",
    slug: "dragonscale-helm",
    description: "Fitted scale plate that turns aside blade and flame alike.",
    material: "Dragonscale",
    basePriceCents: 38000,
    categorySlug: "helmets",
    variants: sizeVariants("HLM-DRG-SCL", [3, 5, 4, 2]),
  },

  // --- Chestplates ---
  {
    name: "Leather Jerkin",
    slug: "leather-jerkin",
    description: "Flexible and quiet — the choice of scouts and cutpurses in equal measure.",
    material: "Leather",
    basePriceCents: 2600,
    categorySlug: "chestplates",
    variants: sizeVariants("CHT-LTH-JRK", [25, 35, 35, 18]),
  },
  {
    name: "Chainmail Hauberk",
    slug: "chainmail-hauberk",
    description: "Thousands of interlocked rings, heavy but forgiving in a scrap.",
    material: "Iron",
    basePriceCents: 9600,
    categorySlug: "chestplates",
    variants: sizeVariants("CHT-IRN-HBK", [15, 22, 22, 10]),
  },
  {
    name: "Steel Plate Cuirass",
    slug: "steel-plate-cuirass",
    description: "The backbone of a knight's kit — rigid, heavy, and hard to get past.",
    material: "Steel",
    basePriceCents: 15500,
    categorySlug: "chestplates",
    variants: sizeVariants("CHT-STL-CRS", [8, 14, 14, 6]),
  },
  {
    name: "Mithril Chestplate",
    slug: "mithril-chestplate",
    description: "Plate-grade protection at a fraction of the weight — and the price to match.",
    material: "Mithril",
    basePriceCents: 52000,
    categorySlug: "chestplates",
    variants: sizeVariants("CHT-MTH-PLT", [2, 4, 4, 2]),
    isFeatured: true,
  },

  // --- Cloaks ---
  {
    name: "Traveler's Cloak",
    slug: "travelers-cloak",
    description: "Oiled wool that sheds rain and road-dust in equal measure.",
    material: "Wool",
    basePriceCents: 2200,
    categorySlug: "cloaks",
    variants: sizeVariants("CLK-WL-TRV", [30, 40, 40, 20]),
  },
  {
    name: "Ranger's Hooded Cloak",
    slug: "rangers-hooded-cloak",
    description: "Mottled green and brown, cut to blend into the treeline.",
    material: "Wool & Leather",
    basePriceCents: 4800,
    categorySlug: "cloaks",
    variants: sizeVariants("CLK-RNG-HD", [15, 25, 25, 12]),
  },
  {
    name: "Shadowweave Cloak",
    slug: "shadowweave-cloak",
    description: "Woven with something that isn't quite thread — it drinks torchlight rather than reflecting it.",
    material: "Shadowweave",
    basePriceCents: 26000,
    categorySlug: "cloaks",
    variants: sizeVariants("CLK-SHD-WV", [4, 7, 7, 3]),
    isFeatured: true,
  },
  {
    name: "Royal Velvet Cloak",
    slug: "royal-velvet-cloak",
    description: "Trimmed in gold thread, worn by those with a court to attend rather than a battle.",
    material: "Velvet",
    basePriceCents: 18500,
    categorySlug: "cloaks",
    variants: sizeVariants("CLK-RYL-VLV", [6, 10, 10, 5]),
  },

  // --- Relics ---
  {
    name: "Amulet of Warding",
    slug: "amulet-of-warding",
    description: "A dull grey stone on a plain chain — until it flares white at the first sign of danger.",
    material: "Warded Stone",
    basePriceCents: 21000,
    categorySlug: "relics",
    variants: singleVariant("RLC-AML-WRD", 9),
  },
  {
    name: "Ring of the Ember King",
    slug: "ring-of-the-ember-king",
    description: "Faintly warm to the touch, always. No one has explained why.",
    material: "Gold & Ember",
    basePriceCents: 34000,
    categorySlug: "relics",
    variants: singleVariant("RLC-RNG-EMB", 5),
  },
  {
    name: "Shard of the Frostfall Blade",
    slug: "shard-of-the-frostfall-blade",
    description: "All that remains of a legendary sword — still cold enough to frost a gauntlet.",
    material: "Enchanted Ice",
    basePriceCents: 45000,
    categorySlug: "relics",
    variants: singleVariant("RLC-SHD-FRS", 3),
    isFeatured: true,
  },
  {
    name: "Idol of the Sunken Temple",
    slug: "idol-of-the-sunken-temple",
    description: "Recovered from beneath the tideline — the carvings shift if you look away and back.",
    material: "Coral & Bronze",
    basePriceCents: 29000,
    categorySlug: "relics",
    variants: singleVariant("RLC-IDL-SNK", 4),
  },

  // --- Potions ---
  {
    name: "Minor Healing Potion",
    slug: "minor-healing-potion",
    description: "Closes shallow cuts and eases bruising within minutes.",
    material: "Herbal Tincture",
    basePriceCents: 800,
    categorySlug: "potions",
    variants: singleVariant("PTN-HLM-MIN", 120),
  },
  {
    name: "Greater Healing Potion",
    slug: "greater-healing-potion",
    description: "Mends deep wounds fast enough to get you back on your feet mid-brawl.",
    material: "Herbal Tincture",
    basePriceCents: 2600,
    categorySlug: "potions",
    variants: singleVariant("PTN-HLG-GRT", 60),
  },
  {
    name: "Elixir of Swift Feet",
    slug: "elixir-of-swift-feet",
    description: "A brief but noticeable spring in your step — favored by couriers and thieves.",
    material: "Alchemical Brew",
    basePriceCents: 1600,
    categorySlug: "potions",
    variants: singleVariant("PTN-SWF-FT", 45),
  },
  {
    name: "Potion of Giant Strength",
    slug: "potion-of-giant-strength",
    description: "Ten minutes of strength you did not have ten minutes ago.",
    material: "Alchemical Brew",
    basePriceCents: 3200,
    categorySlug: "potions",
    variants: singleVariant("PTN-GNT-STR", 30),
  },
  {
    name: "Antidote Vial",
    slug: "antidote-vial",
    description: "Broad-spectrum, bitter, and worth carrying two of.",
    material: "Herbal Tincture",
    basePriceCents: 1100,
    categorySlug: "potions",
    variants: singleVariant("PTN-ANT-VL", 70),
  },

  // --- Banners ---
  {
    name: "Guild Standard Banner",
    slug: "guild-standard-banner",
    description: "Plain, sturdy, and easy to spot across a crowded market square.",
    material: "Canvas",
    basePriceCents: 3200,
    categorySlug: "banners",
    variants: singleVariant("BNR-GLD-STD", 20),
  },
  {
    name: "Crimson War Banner",
    slug: "crimson-war-banner",
    description: "Meant to be seen from the far side of a battlefield — and it is.",
    material: "Dyed Wool",
    basePriceCents: 5400,
    categorySlug: "banners",
    variants: singleVariant("BNR-CRM-WAR", 12),
  },
  {
    name: "Emblem of the Silver Watch",
    slug: "emblem-of-the-silver-watch",
    description: "Embroidered in real silver thread — heavier, and pricier, than it looks.",
    material: "Silk & Silver Thread",
    basePriceCents: 9800,
    categorySlug: "banners",
    variants: singleVariant("BNR-SLV-WCH", 7),
    isFeatured: true,
  },
  {
    name: "Tattered Field Banner",
    slug: "tattered-field-banner",
    description: "Carried through a real campaign and it shows — sold as-is, scars included.",
    material: "Weathered Canvas",
    basePriceCents: 2400,
    categorySlug: "banners",
    variants: singleVariant("BNR-TTR-FLD", 9),
  },
];

async function main() {
  console.log("Seeding categories...");
  const categoryIdBySlug = new Map<string, string>();

  const topLevel = CATEGORIES.filter((c) => !("parentSlug" in c));
  for (const c of topLevel) {
    const row = first(
      await db
        .insert(category)
        .values({ name: c.name, slug: c.slug })
        .returning({ id: category.id, slug: category.slug }),
      c.slug,
    );
    categoryIdBySlug.set(row.slug, row.id);
  }

  const nested = CATEGORIES.filter(
    (c): c is (typeof CATEGORIES)[number] & { parentSlug: string } =>
      "parentSlug" in c,
  );
  for (const c of nested) {
    const parentId = categoryIdBySlug.get(c.parentSlug);
    if (!parentId) throw new Error(`Unknown parent category: ${c.parentSlug}`);
    const row = first(
      await db
        .insert(category)
        .values({ name: c.name, slug: c.slug, parentId })
        .returning({ id: category.id, slug: category.slug }),
      c.slug,
    );
    categoryIdBySlug.set(row.slug, row.id);
  }

  console.log(`Seeding ${PRODUCTS.length} products...`);
  for (const p of PRODUCTS) {
    const categoryId = categoryIdBySlug.get(p.categorySlug);
    if (!categoryId) throw new Error(`Unknown category: ${p.categorySlug}`);

    const row = first(
      await db
        .insert(product)
        .values({
          name: p.name,
          slug: p.slug,
          description: p.description,
          material: p.material,
          basePriceCents: p.basePriceCents,
          categoryId,
          status: "active",
          isFeatured: p.isFeatured ?? false,
        })
        .returning({ id: product.id }),
      p.slug,
    );

    await db.insert(productImage).values({
      productId: row.id,
      url: placeholderImage(p.slug),
      altText: p.name,
      position: 0,
    });

    await db.insert(productVariant).values(
      p.variants.map((v) => ({
        productId: row.id,
        name: v.name,
        sku: v.sku,
        stock: v.stock,
        priceOverrideCents: v.priceOverrideCents,
        attributes: v.attributes,
      })),
    );
  }

  console.log("Seeding admin user...");
  // Role-only row — no login credential yet, since Better Auth's password
  // hashing isn't wired until Phase 2. This lets Phase 3/4 work (which reads
  // `user`/`role` but doesn't need a real login) proceed against seed data.
  // Once Phase 2 lands, promote a real signed-up account to admin instead of
  // trying to log into this row directly (its id isn't one Better Auth
  // issued, and its email is reserved by this unique constraint either way):
  //   update "user" set role = 'admin' where email = 'you@example.com';
  await db.insert(user).values({
    id: "seed-admin",
    name: "Medivi Admin",
    email: "admin@medivi.shop",
    emailVerified: true,
    role: "admin",
  });

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
