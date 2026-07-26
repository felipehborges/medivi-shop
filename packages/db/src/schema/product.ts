import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { category } from "./category";
import { tsvector } from "../lib/custom-types";

export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "active",
  "archived",
]);

export const product = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    longDescription: text("long_description"),
    material: text("material"),
    basePriceCents: integer("base_price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: productStatusEnum("status").notNull().default("draft"),
    isFeatured: boolean("is_featured").notNull().default(false),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', ${product.name}), 'A') || setweight(to_tsvector('english', coalesce(${product.description}, '')), 'B')`,
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("product_search_idx").using("gin", table.searchVector),
    index("product_category_idx").on(table.categoryId),
    index("product_featured_idx")
      .on(table.isFeatured, table.createdAt)
      .where(sql`${table.status} = 'active'`),
    // Requires the pg_trgm extension — enabled by migration 0003 alongside
    // this index, since drizzle-kit has no schema-level way to express
    // `CREATE EXTENSION`. Backs the fuzzy fallback in `searchProducts`.
    index("product_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
  ],
);

export const productImage = pgTable(
  "product_image",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    altText: text("alt_text").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("product_image_product_idx").on(table.productId)],
);

/**
 * Every product gets at least one variant row at creation time — even
 * single-SKU products — so stock/price logic never branches on "does this
 * product have variants" (see docs/architecture.md §3).
 */
export const productVariant = pgTable(
  "product_variant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku").notNull().unique(),
    priceOverrideCents: integer("price_override_cents"),
    stock: integer("stock").notNull().default(0),
    attributes: jsonb("attributes").$type<Record<string, string>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("product_variant_product_idx").on(table.productId),
    check("product_variant_stock_non_negative", sql`${table.stock} >= 0`),
  ],
);
