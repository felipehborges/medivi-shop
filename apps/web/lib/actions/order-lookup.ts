"use server";

import { db } from "@medivi/db/client";
import { getOrderForGuestLookup } from "@medivi/db/queries";
import { orderLookupSchema, type OrderLookupInput } from "@/lib/schemas/order-lookup";

export type OrderLookupResult = { ok: true; orderId: string } | { ok: false };

/** Requires both the order number and the guest email on file to match (see docs/spec.md §7). */
export async function lookupGuestOrderAction(input: OrderLookupInput): Promise<OrderLookupResult> {
  const parsed = orderLookupSchema.parse(input);
  const order = await getOrderForGuestLookup(db, parsed.orderNumber, parsed.email);
  if (!order) return { ok: false };
  return { ok: true, orderId: order.id };
}
