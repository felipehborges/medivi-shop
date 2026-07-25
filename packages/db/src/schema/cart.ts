import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { productVariant } from "./product";

/**
 * A cart is either guest (`guestToken` set, `userId` null) or authenticated
 * (`userId` set, `guestToken` null) — never both. `guestToken` is the value
 * carried in a signed httpOnly cookie (see docs/architecture.md §2), not a
 * guessable sequential id.
 */
export const cart = pgTable(
  "cart",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    guestToken: text("guest_token").unique(),
    currency: text("currency").notNull().default("USD"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "cart_owner_xor",
      sql`(${table.userId} is null) != (${table.guestToken} is null)`,
    ),
  ],
);

export const cartItem = pgTable(
  "cart_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => cart.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    priceSnapshotCents: integer("price_snapshot_cents").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cart_item_cart_variant_idx").on(table.cartId, table.variantId),
    check("cart_item_quantity_positive", sql`${table.quantity} > 0`),
  ],
);
