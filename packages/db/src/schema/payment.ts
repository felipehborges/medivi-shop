import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { order } from "./order";

export const paymentStatusEnum = pgEnum("payment_status", [
  "requires_payment",
  "processing",
  "succeeded",
  "failed",
  "refunded",
]);

export const paymentProviderEnum = pgEnum("payment_provider", ["stripe", "mock"]);

/**
 * One row per order today; not unique-constrained on `orderId` so a future
 * partial-capture/refund-history model can add more rows without a schema
 * change (see docs/architecture.md §3).
 */
export const payment = pgTable("payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => order.id, { onDelete: "cascade" }),
  provider: paymentProviderEnum("provider").notNull(),
  providerRef: text("provider_ref").notNull(),
  status: paymentStatusEnum("status").notNull().default("requires_payment"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  rawEventLog: jsonb("raw_event_log"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Idempotency ledger keyed by the payment provider's own event id — a
 * redelivered webhook is a no-op because its id is already present here
 * (see docs/architecture.md §4).
 */
export const processedWebhookEvent = pgTable("processed_webhook_event", {
  eventId: text("event_id").primaryKey(),
  provider: paymentProviderEnum("provider").notNull(),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});
