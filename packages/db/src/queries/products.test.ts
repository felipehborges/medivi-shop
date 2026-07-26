import { describe, expect, it } from "vitest";
import { withTestTransaction } from "../test";
import { category, product, productImage, productVariant } from "../schema";
import type { Tx } from "../lib/db-client";
import { getProductBySlug, listMaterials, listProducts, listRelatedProducts } from "./products";

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

async function makeCategory(
  tx: Tx,
  overrides: Partial<typeof category.$inferInsert> = {},
) {
  const slug = overrides.slug ?? unique("cat");
  const [row] = await tx
    .insert(category)
    .values({ name: overrides.name ?? slug, slug, ...overrides })
    .returning();
  return row!;
}

async function makeProduct(
  tx: Tx,
  categoryId: string,
  overrides: Partial<typeof product.$inferInsert> = {},
) {
  const slug = overrides.slug ?? unique("prod");
  const [row] = await tx
    .insert(product)
    .values({
      categoryId,
      name: overrides.name ?? slug,
      slug,
      basePriceCents: overrides.basePriceCents ?? 1000,
      status: overrides.status ?? "active",
      ...overrides,
    })
    .returning();
  return row!;
}

async function makeVariant(tx: Tx, productId: string, stock: number) {
  await tx.insert(productVariant).values({
    productId,
    name: "Standard",
    sku: unique("SKU"),
    stock,
  });
}

async function insertVariant(
  tx: Tx,
  productId: string,
  overrides: Partial<typeof productVariant.$inferInsert> = {},
) {
  const [row] = await tx
    .insert(productVariant)
    .values({
      productId,
      name: overrides.name ?? "Standard",
      sku: overrides.sku ?? unique("SKU"),
      stock: overrides.stock ?? 1,
      ...overrides,
    })
    .returning();
  return row!;
}

describe("listProducts", () => {
  it("only returns active products", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const active = await makeProduct(tx, cat.id, { status: "active" });
      await makeProduct(tx, cat.id, { status: "draft" });
      await makeVariant(tx, active.id, 5);

      const result = await listProducts(tx, { categorySlug: cat.slug });
      expect(result.items.map((p) => p.id)).toEqual([active.id]);
    });
  });

  it("filters by category including its direct children", async () => {
    await withTestTransaction(async (tx) => {
      const parent = await makeCategory(tx);
      const child = await makeCategory(tx, { parentId: parent.id });
      const other = await makeCategory(tx);

      const inParent = await makeProduct(tx, parent.id);
      const inChild = await makeProduct(tx, child.id);
      const inOther = await makeProduct(tx, other.id);
      await makeVariant(tx, inParent.id, 5);
      await makeVariant(tx, inChild.id, 5);
      await makeVariant(tx, inOther.id, 5);

      const result = await listProducts(tx, { categorySlug: parent.slug });
      const ids = result.items.map((p) => p.id).sort();
      expect(ids).toEqual([inParent.id, inChild.id].sort());
    });
  });

  it("filters by price range", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const cheap = await makeProduct(tx, cat.id, { basePriceCents: 500 });
      const mid = await makeProduct(tx, cat.id, { basePriceCents: 1500 });
      const pricey = await makeProduct(tx, cat.id, { basePriceCents: 5000 });
      for (const p of [cheap, mid, pricey]) await makeVariant(tx, p.id, 5);

      const result = await listProducts(tx, {
        categorySlug: cat.slug,
        minPriceCents: 1000,
        maxPriceCents: 2000,
      });
      expect(result.items.map((p) => p.id)).toEqual([mid.id]);
    });
  });

  it("filters by material case-insensitively", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const iron = await makeProduct(tx, cat.id, { material: "Iron" });
      const steel = await makeProduct(tx, cat.id, { material: "Steel" });
      await makeVariant(tx, iron.id, 5);
      await makeVariant(tx, steel.id, 5);

      const result = await listProducts(tx, {
        categorySlug: cat.slug,
        material: "iron",
      });
      expect(result.items.map((p) => p.id)).toEqual([iron.id]);
    });
  });

  it("filters to in-stock products only", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const inStock = await makeProduct(tx, cat.id);
      const outOfStock = await makeProduct(tx, cat.id);
      await makeVariant(tx, inStock.id, 3);
      await makeVariant(tx, outOfStock.id, 0);

      const all = await listProducts(tx, { categorySlug: cat.slug });
      expect(all.items.map((p) => p.id).sort()).toEqual(
        [inStock.id, outOfStock.id].sort(),
      );
      expect(all.items.find((p) => p.id === outOfStock.id)?.inStock).toBe(false);

      const filtered = await listProducts(tx, {
        categorySlug: cat.slug,
        inStockOnly: true,
      });
      expect(filtered.items.map((p) => p.id)).toEqual([inStock.id]);
    });
  });

  it("sorts by price ascending and descending", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const low = await makeProduct(tx, cat.id, { basePriceCents: 100 });
      const high = await makeProduct(tx, cat.id, { basePriceCents: 900 });
      await makeVariant(tx, low.id, 1);
      await makeVariant(tx, high.id, 1);

      const asc = await listProducts(tx, { categorySlug: cat.slug, sort: "price-asc" });
      expect(asc.items.map((p) => p.id)).toEqual([low.id, high.id]);

      const desc = await listProducts(tx, { categorySlug: cat.slug, sort: "price-desc" });
      expect(desc.items.map((p) => p.id)).toEqual([high.id, low.id]);
    });
  });

  it("sorts featured products first", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const plain = await makeProduct(tx, cat.id, { isFeatured: false });
      const featured = await makeProduct(tx, cat.id, { isFeatured: true });
      await makeVariant(tx, plain.id, 1);
      await makeVariant(tx, featured.id, 1);

      const result = await listProducts(tx, { categorySlug: cat.slug, sort: "featured" });
      expect(result.items[0]?.id).toBe(featured.id);
    });
  });

  it("paginates results", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      for (let i = 0; i < 5; i++) {
        const p = await makeProduct(tx, cat.id, { basePriceCents: 100 * (i + 1) });
        await makeVariant(tx, p.id, 1);
      }

      const page1 = await listProducts(tx, {
        categorySlug: cat.slug,
        sort: "price-asc",
        page: 1,
        pageSize: 2,
      });
      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.totalPages).toBe(3);

      const page3 = await listProducts(tx, {
        categorySlug: cat.slug,
        sort: "price-asc",
        page: 3,
        pageSize: 2,
      });
      expect(page3.items).toHaveLength(1);
    });
  });

  it("returns the lowest-position image for each product", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const p = await makeProduct(tx, cat.id);
      await makeVariant(tx, p.id, 1);
      await tx.insert(productImage).values([
        { productId: p.id, url: "second.jpg", altText: "second", position: 1 },
        { productId: p.id, url: "first.jpg", altText: "first", position: 0 },
      ]);

      const result = await listProducts(tx, { categorySlug: cat.slug });
      expect(result.items[0]?.imageUrl).toBe("first.jpg");
      expect(result.items[0]?.imageAlt).toBe("first");
    });
  });

  it("returns an empty page for an unknown category slug", async () => {
    await withTestTransaction(async (tx) => {
      const result = await listProducts(tx, { categorySlug: "no-such-category" });
      expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 24, totalPages: 0 });
    });
  });
});

describe("listMaterials", () => {
  it("returns distinct, sorted materials for active products in a category", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const other = await makeCategory(tx);
      const steel1 = await makeProduct(tx, cat.id, { material: "Steel" });
      const steel2 = await makeProduct(tx, cat.id, { material: "Steel" });
      const iron = await makeProduct(tx, cat.id, { material: "Iron" });
      const draft = await makeProduct(tx, cat.id, { material: "Draftium", status: "draft" });
      const elsewhere = await makeProduct(tx, other.id, { material: "Elsewhere" });
      for (const p of [steel1, steel2, iron, draft, elsewhere]) await makeVariant(tx, p.id, 1);

      const materials = await listMaterials(tx, cat.slug);
      expect(materials).toEqual(["Iron", "Steel"]);
    });
  });

  it("returns materials across all categories when no slug is given", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const p = await makeProduct(tx, cat.id, { material: "Adamantine" });
      await makeVariant(tx, p.id, 1);

      const materials = await listMaterials(tx);
      expect(materials).toContain("Adamantine");
    });
  });
});

describe("listProducts search", () => {
  it("matches on product name", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const match = await makeProduct(tx, cat.id, { name: "Gryphon Feather Cloak" });
      const other = await makeProduct(tx, cat.id, { name: "Plain Wool Cloak" });
      await makeVariant(tx, match.id, 1);
      await makeVariant(tx, other.id, 1);

      const result = await listProducts(tx, { categorySlug: cat.slug, query: "gryphon" });
      expect(result.items.map((p) => p.id)).toEqual([match.id]);
    });
  });

  it("matches on description text", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const match = await makeProduct(tx, cat.id, {
        name: "Mystery Box",
        description: "Contains a randomized enchanted trinket.",
      });
      await makeVariant(tx, match.id, 1);

      const result = await listProducts(tx, { categorySlug: cat.slug, query: "enchanted trinket" });
      expect(result.items.map((p) => p.id)).toEqual([match.id]);
    });
  });

  it("falls back to trigram similarity for a typo", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const match = await makeProduct(tx, cat.id, { name: "Basilisk Scale Buckler" });
      await makeVariant(tx, match.id, 1);

      const result = await listProducts(tx, { categorySlug: cat.slug, query: "baziliks" });
      expect(result.items.map((p) => p.id)).toContain(match.id);
    });
  });

  it("returns no results for an unrelated query", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const p = await makeProduct(tx, cat.id, { name: "Basilisk Scale Buckler" });
      await makeVariant(tx, p.id, 1);

      const result = await listProducts(tx, {
        categorySlug: cat.slug,
        query: "completely unrelated gibberish query",
      });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  it("ranks a closer name match above a description-only match", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const nameMatch = await makeProduct(tx, cat.id, { name: "Griffon Talon Dagger" });
      const descMatch = await makeProduct(tx, cat.id, {
        name: "Plain Dagger",
        description: "Favored by scouts who track griffon nests.",
      });
      await makeVariant(tx, nameMatch.id, 1);
      await makeVariant(tx, descMatch.id, 1);

      const result = await listProducts(tx, { categorySlug: cat.slug, query: "griffon" });
      expect(result.items[0]?.id).toBe(nameMatch.id);
    });
  });

  it("lets an explicit sort override relevance ordering", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const cheap = await makeProduct(tx, cat.id, { name: "Dragon Whistle", basePriceCents: 500 });
      const pricey = await makeProduct(tx, cat.id, { name: "Dragon Amulet", basePriceCents: 9000 });
      await makeVariant(tx, cheap.id, 1);
      await makeVariant(tx, pricey.id, 1);

      const result = await listProducts(tx, {
        categorySlug: cat.slug,
        query: "dragon",
        sort: "price-asc",
      });
      expect(result.items.map((p) => p.id)).toEqual([cheap.id, pricey.id]);
    });
  });
});

describe("getProductBySlug", () => {
  it("returns null for a draft or missing product", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const draft = await makeProduct(tx, cat.id, { status: "draft" });

      expect(await getProductBySlug(tx, draft.slug)).toBeNull();
      expect(await getProductBySlug(tx, "no-such-slug")).toBeNull();
    });
  });

  it("returns category info, images ordered by position, and variant price overrides", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx, { name: "Helmets", slug: unique("helmets") });
      const p = await makeProduct(tx, cat.id, {
        name: "Iron Helm",
        basePriceCents: 3000,
        description: "A sturdy helm.",
      });
      await tx.insert(productImage).values([
        { productId: p.id, url: "second.jpg", altText: "second", position: 1 },
        { productId: p.id, url: "first.jpg", altText: "first", position: 0 },
      ]);
      await insertVariant(tx, p.id, { name: "Standard", stock: 10 });
      const overridden = await insertVariant(tx, p.id, {
        name: "Gilded",
        stock: 2,
        priceOverrideCents: 9000,
      });

      const detail = await getProductBySlug(tx, p.slug);

      expect(detail?.categoryName).toBe("Helmets");
      expect(detail?.categorySlug).toBe(cat.slug);
      expect(detail?.images.map((i) => i.url)).toEqual(["first.jpg", "second.jpg"]);
      const gilded = detail?.variants.find((v) => v.id === overridden.id);
      expect(gilded?.priceCents).toBe(9000);
    });
  });

  it("orders sized variants by garment size, not alphabetically", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const p = await makeProduct(tx, cat.id);
      await insertVariant(tx, p.id, { name: "Size: L", attributes: { size: "L" } });
      await insertVariant(tx, p.id, { name: "Size: S", attributes: { size: "S" } });
      await insertVariant(tx, p.id, { name: "Size: XL", attributes: { size: "XL" } });
      await insertVariant(tx, p.id, { name: "Size: M", attributes: { size: "M" } });

      const detail = await getProductBySlug(tx, p.slug);
      expect(detail?.variants.map((v) => v.attributes?.size)).toEqual(["S", "M", "L", "XL"]);
    });
  });
});

describe("listRelatedProducts", () => {
  it("returns other active products in the same category, excluding the given one", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const other = await makeCategory(tx);
      const current = await makeProduct(tx, cat.id);
      const sibling = await makeProduct(tx, cat.id);
      const draftSibling = await makeProduct(tx, cat.id, { status: "draft" });
      const elsewhere = await makeProduct(tx, other.id);
      for (const p of [current, sibling, draftSibling, elsewhere]) await makeVariant(tx, p.id, 1);

      const related = await listRelatedProducts(tx, {
        categoryId: cat.id,
        excludeProductId: current.id,
      });

      expect(related.map((p) => p.id)).toEqual([sibling.id]);
    });
  });

  it("respects the limit", async () => {
    await withTestTransaction(async (tx) => {
      const cat = await makeCategory(tx);
      const current = await makeProduct(tx, cat.id);
      await makeVariant(tx, current.id, 1);
      for (let i = 0; i < 5; i++) {
        const p = await makeProduct(tx, cat.id);
        await makeVariant(tx, p.id, 1);
      }

      const related = await listRelatedProducts(tx, {
        categoryId: cat.id,
        excludeProductId: current.id,
        limit: 3,
      });

      expect(related).toHaveLength(3);
    });
  });
});

// These read the real seed catalog (packages/db/src/seed.ts) rather than
// per-test fixtures — they assert against stable, well-known seed facts
// (product names, category membership) so they stay meaningful without
// pinning to exact counts that would break every time the catalog grows.
describe("listProducts against seed data", () => {
  it("filters and sorts the seeded swords category by price", async () => {
    await withTestTransaction(async (tx) => {
      const result = await listProducts(tx, {
        categorySlug: "swords",
        sort: "price-asc",
        pageSize: 50,
      });

      expect(result.items.length).toBeGreaterThanOrEqual(6);
      expect(result.items.map((p) => p.name)).toContain("Iron Longsword");
      const prices = result.items.map((p) => p.basePriceCents);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });
  });

  it("finds seeded healing potions by search relevance, ranked above unrelated matches", async () => {
    await withTestTransaction(async (tx) => {
      const result = await listProducts(tx, { query: "healing potion" });
      const names = result.items.map((p) => p.name);

      expect(names).toContain("Minor Healing Potion");
      expect(names).toContain("Greater Healing Potion");
      // Both healing potions should rank in the top few relevance-sorted results.
      expect(names.indexOf("Minor Healing Potion")).toBeLessThan(3);
      expect(names.indexOf("Greater Healing Potion")).toBeLessThan(3);
    });
  });

  it("tolerates a realistic typo against seed product names", async () => {
    await withTestTransaction(async (tx) => {
      const result = await listProducts(tx, { query: "loongsword" });
      expect(result.items.map((p) => p.name)).toContain("Iron Longsword");
    });
  });
});

describe("listProducts query count", () => {
  async function seedProducts(tx: Tx, categoryId: string, n: number) {
    for (let i = 0; i < n; i++) {
      const p = await makeProduct(tx, categoryId, { basePriceCents: 100 * (i + 1) });
      await makeVariant(tx, p.id, 1);
      await tx.insert(productImage).values({
        productId: p.id,
        url: `${i}.jpg`,
        altText: "img",
        position: 0,
      });
    }
  }

  it("issues the same number of queries whether 5 or 20 rows are returned (no N+1)", async () => {
    let smallCount = 0;
    let largeCount = 0;

    await withTestTransaction(
      async (tx) => {
        const cat = await makeCategory(tx);
        await seedProducts(tx, cat.id, 5);

        smallCount = 0;
        const result = await listProducts(tx, { categorySlug: cat.slug, pageSize: 5 });
        expect(result.items).toHaveLength(5);
      },
      { onQuery: () => smallCount++ },
    );

    await withTestTransaction(
      async (tx) => {
        const cat = await makeCategory(tx);
        await seedProducts(tx, cat.id, 20);

        largeCount = 0;
        const result = await listProducts(tx, { categorySlug: cat.slug, pageSize: 20 });
        expect(result.items).toHaveLength(20);
      },
      { onQuery: () => largeCount++ },
    );

    expect(largeCount).toBe(smallCount);
  });
});
