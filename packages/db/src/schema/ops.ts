import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { productVariant } from "./product";

export const inventoryChangeReasonEnum = pgEnum("inventory_change_reason", [
  "order",
  "restock",
  "adjustment",
]);

export type InventoryChangeReason = (typeof inventoryChangeReasonEnum.enumValues)[number];

export const inventoryLog = pgTable("inventory_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => productVariant.id, { onDelete: "cascade" }),
  change: integer("change").notNull(),
  reason: inventoryChangeReasonEnum("reason").notNull(),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Append-only — the app never updates or deletes a row here. */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  diff: jsonb("diff"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const analyticsEventTypeEnum = pgEnum("analytics_event_type", [
  "page_view",
  "add_to_cart",
  "wishlist_add",
  "checkout_started",
  "checkout_completed",
  "search_performed",
]);

export const analyticsEvent = pgTable("analytics_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: text("session_id").notNull(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  type: analyticsEventTypeEnum("type").notNull(),
  path: text("path"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
