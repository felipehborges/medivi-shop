"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@medivi/db/client";
import { getLatestPaymentForOrder, markOrderRefunded } from "@medivi/db/queries";
import { requireAdmin } from "@/lib/auth-guards";
import { getPaymentProvider } from "@/lib/payments";

const refundOrderSchema = z.object({ orderId: z.string().uuid() });

export type RefundActionResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "invalid_state" | "provider_error"; message?: string };

/** Admin-only; every admin server action re-checks the caller's role itself (see CLAUDE.md). */
export async function refundOrderAction(input: z.infer<typeof refundOrderSchema>): Promise<RefundActionResult> {
  const admin = await requireAdmin();
  const { orderId } = refundOrderSchema.parse(input);

  const latestPayment = await getLatestPaymentForOrder(db, orderId);
  if (!latestPayment) return { ok: false, reason: "not_found" };
  if (latestPayment.status !== "succeeded") return { ok: false, reason: "invalid_state" };

  const provider = getPaymentProvider();
  const refundResult = await provider.refund(latestPayment.providerRef, latestPayment.amountCents);
  if (!refundResult.ok) return { ok: false, reason: "provider_error", message: refundResult.reason };

  const outcome = await markOrderRefunded(db, orderId, admin.id);
  if (!outcome.ok) return outcome;

  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}
