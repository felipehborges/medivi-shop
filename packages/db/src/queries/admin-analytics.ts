import { and, asc, count, countDistinct, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import type { DbClient } from "../lib/db-client";
import { analyticsEvent, order, orderItem, product, productVariant } from "../schema";

/** Revenue only counts orders that actually collected money — `pending`/`cancelled` never contribute. */
const REVENUE_STATUSES = ["paid", "fulfilled"] as const;

export type RevenuePoint = { date: string; revenueCents: number; orderCount: number };

export async function revenueOverTime(db: DbClient, days = 30): Promise<RevenuePoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const dateBucket = sql<string>`to_char(${order.createdAt}, 'YYYY-MM-DD')`;

  return db
    .select({
      date: dateBucket,
      revenueCents: sql<number>`coalesce(sum(${order.totalCents}), 0)`.mapWith(Number),
      orderCount: count(),
    })
    .from(order)
    .where(and(inArray(order.status, REVENUE_STATUSES), gte(order.createdAt, since)))
    .groupBy(dateBucket)
    .orderBy(asc(dateBucket));
}

export type TopProduct = { productId: string; name: string; revenueCents: number; unitsSold: number };

export async function topProductsByRevenue(db: DbClient, limit = 5): Promise<TopProduct[]> {
  return db
    .select({
      productId: orderItem.productId,
      name: product.name,
      revenueCents: sql<number>`coalesce(sum(${orderItem.lineTotalCents}), 0)`.mapWith(Number),
      unitsSold: sql<number>`coalesce(sum(${orderItem.quantity}), 0)`.mapWith(Number),
    })
    .from(orderItem)
    .innerJoin(order, eq(order.id, orderItem.orderId))
    .innerJoin(product, eq(product.id, orderItem.productId))
    .where(inArray(order.status, REVENUE_STATUSES))
    .groupBy(orderItem.productId, product.name)
    .orderBy(desc(sql`sum(${orderItem.lineTotalCents})`))
    .limit(limit);
}

export type LowStockAlert = {
  variantId: string;
  variantName: string;
  productId: string;
  productName: string;
  stock: number;
};

/** Only `active` products — a low-stock draft/archived variant isn't actionable the same way. */
export async function lowStockAlerts(db: DbClient, threshold = 5): Promise<LowStockAlert[]> {
  return db
    .select({
      variantId: productVariant.id,
      variantName: productVariant.name,
      productId: product.id,
      productName: product.name,
      stock: productVariant.stock,
    })
    .from(productVariant)
    .innerJoin(product, eq(product.id, productVariant.productId))
    .where(and(lte(productVariant.stock, threshold), eq(product.status, "active")))
    .orderBy(asc(productVariant.stock));
}

export type ConversionFunnel = {
  pageViews: number;
  addToCart: number;
  checkoutStarted: number;
  checkoutCompleted: number;
};

const FUNNEL_EVENT_TYPES = ["page_view", "add_to_cart", "checkout_started", "checkout_completed"] as const;

/**
 * Counts *distinct sessions* that reached each milestone, not raw event
 * counts — a session with three page views only counts once, so the funnel
 * reads as a conversion rate rather than an activity volume (see
 * docs/spec.md §"Analytics/telemetry").
 */
export async function conversionFunnel(db: DbClient, days = 30): Promise<ConversionFunnel> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      type: analyticsEvent.type,
      sessions: countDistinct(analyticsEvent.sessionId),
    })
    .from(analyticsEvent)
    .where(and(inArray(analyticsEvent.type, FUNNEL_EVENT_TYPES), gte(analyticsEvent.createdAt, since)))
    .groupBy(analyticsEvent.type);

  const sessionsByType = new Map(rows.map((r) => [r.type, r.sessions]));
  return {
    pageViews: sessionsByType.get("page_view") ?? 0,
    addToCart: sessionsByType.get("add_to_cart") ?? 0,
    checkoutStarted: sessionsByType.get("checkout_started") ?? 0,
    checkoutCompleted: sessionsByType.get("checkout_completed") ?? 0,
  };
}
