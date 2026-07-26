import { randomBytes } from "node:crypto";

import { and, asc, desc, eq, gte, sql } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import {
  auditLog,
  cart,
  cartItem,
  inventoryLog,
  order,
  orderItem,
  payment,
  processedWebhookEvent,
  product,
  productVariant,
  type AddressSnapshot,
  type OrderStatus,
  type PaymentProviderName,
  type PaymentStatus,
} from "../schema";

function generateOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = randomBytes(4).toString("hex").toUpperCase();
  return `MDV-${datePart}-${randomPart}`;
}

export type CreateOrderOwner = { userId: string; guestEmail?: never } | { userId?: never; guestEmail: string };

export type CreateOrderInput = {
  shippingAddress: AddressSnapshot;
  shippingCents: number;
};

export type StockOrPriceIssue =
  | { productName: string; kind: "stock"; requested: number; available: number }
  | { productName: string; kind: "price"; oldPriceCents: number; newPriceCents: number };

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: string; subtotalCents: number; totalCents: number }
  | { ok: false; reason: "empty_cart" }
  | { ok: false; reason: "stock_or_price_changed"; issues: StockOrPriceIssue[] };

/**
 * Re-validates every line against *current* DB state (never the cart's
 * cached snapshot) before creating anything — see docs/architecture.md §4.
 * A mismatch on any line blocks the whole checkout so the user can review
 * and adjust, rather than silently charging a different total.
 */
export async function createOrder(
  db: DbClient,
  cartId: string,
  owner: CreateOrderOwner,
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const rows = await db
    .select({
      quantity: cartItem.quantity,
      priceSnapshotCents: cartItem.priceSnapshotCents,
      currentStock: productVariant.stock,
      priceOverrideCents: productVariant.priceOverrideCents,
      basePriceCents: product.basePriceCents,
      productId: product.id,
      productName: product.name,
      variantId: productVariant.id,
      variantName: productVariant.name,
    })
    .from(cartItem)
    .innerJoin(productVariant, eq(productVariant.id, cartItem.variantId))
    .innerJoin(product, eq(product.id, productVariant.productId))
    .where(eq(cartItem.cartId, cartId));

  if (rows.length === 0) return { ok: false, reason: "empty_cart" };

  const issues: StockOrPriceIssue[] = [];
  for (const row of rows) {
    if (row.quantity > row.currentStock) {
      issues.push({
        productName: row.productName,
        kind: "stock",
        requested: row.quantity,
        available: row.currentStock,
      });
      continue;
    }
    const currentPriceCents = row.priceOverrideCents ?? row.basePriceCents;
    if (currentPriceCents !== row.priceSnapshotCents) {
      issues.push({
        productName: row.productName,
        kind: "price",
        oldPriceCents: row.priceSnapshotCents,
        newPriceCents: currentPriceCents,
      });
    }
  }
  if (issues.length > 0) return { ok: false, reason: "stock_or_price_changed", issues };

  const subtotalCents = rows.reduce((sum, r) => sum + r.priceSnapshotCents * r.quantity, 0);
  const totalCents = subtotalCents + input.shippingCents;
  const orderNumber = generateOrderNumber();

  const orderId = await db.transaction(async (tx) => {
    const [newOrder] = await tx
      .insert(order)
      .values({
        orderNumber,
        userId: owner.userId ?? null,
        guestEmail: owner.guestEmail ?? null,
        status: "pending",
        subtotalCents,
        shippingCents: input.shippingCents,
        taxCents: 0,
        totalCents,
        currency: "USD",
        shippingAddress: input.shippingAddress,
      })
      .returning({ id: order.id });
    if (!newOrder) throw new Error("Failed to create order");

    await tx.insert(orderItem).values(
      rows.map((r) => ({
        orderId: newOrder.id,
        productId: r.productId,
        variantId: r.variantId,
        nameSnapshot: r.productName,
        variantLabelSnapshot: r.variantName,
        unitPriceCents: r.priceSnapshotCents,
        quantity: r.quantity,
        lineTotalCents: r.priceSnapshotCents * r.quantity,
      })),
    );

    // The cart is deliberately left intact here — only a *successful*
    // payment clears it (see `fulfillPaidOrder`). If checkout fails or is
    // abandoned, the customer can retry straight from their unchanged cart
    // instead of having to re-add everything (see docs/spec.md §7).

    return newOrder.id;
  });

  return { ok: true, orderId, orderNumber, subtotalCents, totalCents };
}

export async function createPayment(
  db: DbClient,
  input: { orderId: string; provider: PaymentProviderName; providerRef: string; amountCents: number },
): Promise<{ id: string }> {
  const [row] = await db
    .insert(payment)
    .values({
      orderId: input.orderId,
      provider: input.provider,
      providerRef: input.providerRef,
      amountCents: input.amountCents,
      status: "requires_payment",
    })
    .returning({ id: payment.id });
  if (!row) throw new Error("Failed to create payment");
  return row;
}

export type OrderItemDetail = {
  id: string;
  nameSnapshot: string;
  variantLabelSnapshot: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  userId: string | null;
  guestEmail: string | null;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  shippingAddress: AddressSnapshot;
  createdAt: Date;
  latestPaymentStatus: PaymentStatus | null;
  items: OrderItemDetail[];
};

/**
 * No ownership check — reachable right after checkout via an unguessable
 * order id, same as any "emailed receipt link" pattern. The *authenticated*
 * order-history detail page (Phase 6) is the one that must filter by
 * `userId` so a user can't browse orders by guessing ids.
 */
export async function getOrderById(db: DbClient, orderId: string): Promise<OrderDetail | null> {
  const [orderRow] = await db.select().from(order).where(eq(order.id, orderId)).limit(1);
  if (!orderRow) return null;

  const items = await db
    .select({
      id: orderItem.id,
      nameSnapshot: orderItem.nameSnapshot,
      variantLabelSnapshot: orderItem.variantLabelSnapshot,
      unitPriceCents: orderItem.unitPriceCents,
      quantity: orderItem.quantity,
      lineTotalCents: orderItem.lineTotalCents,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId))
    .orderBy(asc(orderItem.createdAt));

  const [latestPayment] = await db
    .select({ status: payment.status })
    .from(payment)
    .where(eq(payment.orderId, orderId))
    .orderBy(desc(payment.createdAt))
    .limit(1);

  return { ...orderRow, items, latestPaymentStatus: latestPayment?.status ?? null };
}

export type FulfillEvent = {
  eventId: string;
  provider: PaymentProviderName;
  orderId: string;
  providerRef: string;
};

export type FulfillOutcome =
  | { outcome: "duplicate" }
  | { outcome: "paid" }
  | { outcome: "oversold"; unavailableVariantIds: string[] };

/**
 * The one place order/payment status flips to "paid" — called from the
 * Stripe webhook route and from the mock provider's approve action alike,
 * so the fulfillment code path is identical either way (see
 * docs/architecture.md §5). Idempotent on `event.eventId`: a redelivered
 * webhook (or a double-clicked mock approval) is a no-op.
 *
 * The stock decrement is the real concurrency backstop (not just the
 * add-to-cart clamp): a guarded `UPDATE ... WHERE stock >= quantity` takes
 * a row lock, so two concurrent fulfillments on the same last-unit variant
 * serialize — the second sees the decremented stock and fails cleanly
 * instead of ever going negative.
 */
export async function fulfillPaidOrder(db: DbClient, event: FulfillEvent): Promise<FulfillOutcome> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(processedWebhookEvent)
      .values({ eventId: event.eventId, provider: event.provider })
      .onConflictDoNothing({ target: processedWebhookEvent.eventId })
      .returning({ eventId: processedWebhookEvent.eventId });
    if (!inserted) return { outcome: "duplicate" };

    const items = await tx
      .select({ variantId: orderItem.variantId, quantity: orderItem.quantity })
      .from(orderItem)
      .where(eq(orderItem.orderId, event.orderId));

    const unavailableVariantIds: string[] = [];
    for (const item of items) {
      const [decremented] = await tx
        .update(productVariant)
        .set({ stock: sql`${productVariant.stock} - ${item.quantity}`, updatedAt: new Date() })
        .where(and(eq(productVariant.id, item.variantId), gte(productVariant.stock, item.quantity)))
        .returning({ id: productVariant.id });

      if (!decremented) {
        unavailableVariantIds.push(item.variantId);
      } else {
        await tx.insert(inventoryLog).values({
          variantId: item.variantId,
          change: -item.quantity,
          reason: "order",
          referenceId: event.orderId,
        });
      }
    }

    if (unavailableVariantIds.length > 0) {
      await tx
        .update(payment)
        .set({ status: "failed", providerRef: event.providerRef, updatedAt: new Date() })
        .where(eq(payment.orderId, event.orderId));
      return { outcome: "oversold", unavailableVariantIds };
    }

    await tx
      .update(payment)
      .set({ status: "succeeded", providerRef: event.providerRef, updatedAt: new Date() })
      .where(eq(payment.orderId, event.orderId));
    await tx
      .update(order)
      .set({ status: "paid", updatedAt: new Date() })
      .where(and(eq(order.id, event.orderId), eq(order.status, "pending")));

    const [orderRow] = await tx.select({ userId: order.userId }).from(order).where(eq(order.id, event.orderId)).limit(1);
    if (orderRow?.userId) {
      const [userCart] = await tx.select({ id: cart.id }).from(cart).where(eq(cart.userId, orderRow.userId)).limit(1);
      if (userCart) await tx.delete(cartItem).where(eq(cartItem.cartId, userCart.id));
    }

    return { outcome: "paid" };
  });
}

export type FailureEvent = { eventId: string; provider: PaymentProviderName; orderId: string };

/** Same idempotency ledger as `fulfillPaidOrder`; leaves the order `pending` so the customer can retry from checkout. */
export async function recordPaymentFailure(
  db: DbClient,
  event: FailureEvent,
): Promise<{ outcome: "duplicate" | "recorded" }> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(processedWebhookEvent)
      .values({ eventId: event.eventId, provider: event.provider })
      .onConflictDoNothing({ target: processedWebhookEvent.eventId })
      .returning({ eventId: processedWebhookEvent.eventId });
    if (!inserted) return { outcome: "duplicate" };

    await tx
      .update(payment)
      .set({ status: "failed", updatedAt: new Date() })
      .where(and(eq(payment.orderId, event.orderId), eq(payment.status, "requires_payment")));
    return { outcome: "recorded" };
  });
}

export async function getLatestPaymentForOrder(
  db: DbClient,
  orderId: string,
): Promise<{ id: string; provider: PaymentProviderName; providerRef: string; amountCents: number; status: PaymentStatus } | null> {
  const [row] = await db
    .select({
      id: payment.id,
      provider: payment.provider,
      providerRef: payment.providerRef,
      amountCents: payment.amountCents,
      status: payment.status,
    })
    .from(payment)
    .where(eq(payment.orderId, orderId))
    .orderBy(desc(payment.createdAt))
    .limit(1);
  return row ?? null;
}

export type RefundOutcome = { ok: true } | { ok: false; reason: "invalid_state" };

/** Enforces the order status machine server-side: only `paid`/`fulfilled` orders can be refunded (see docs/plan.md §9). */
export async function markOrderRefunded(db: DbClient, orderId: string, actorId: string): Promise<RefundOutcome> {
  return db.transaction(async (tx) => {
    const [orderRow] = await tx.select({ status: order.status }).from(order).where(eq(order.id, orderId)).limit(1);
    if (!orderRow || (orderRow.status !== "paid" && orderRow.status !== "fulfilled")) {
      return { ok: false, reason: "invalid_state" };
    }

    await tx.update(order).set({ status: "refunded", updatedAt: new Date() }).where(eq(order.id, orderId));
    await tx.update(payment).set({ status: "refunded", updatedAt: new Date() }).where(eq(payment.orderId, orderId));
    await tx.insert(auditLog).values({
      actorId,
      action: "order.refund",
      entityType: "order",
      entityId: orderId,
      diff: { from: orderRow.status, to: "refunded" },
    });
    return { ok: true };
  });
}
