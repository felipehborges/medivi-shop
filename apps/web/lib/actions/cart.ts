"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@medivi/db/client";
import {
  addCartItem,
  mergeGuestCartIntoUserCart,
  recordAnalyticsEvent,
  removeCartItem,
  updateCartItemQuantity,
  type AddToCartResult,
  type UpdateQuantityResult,
} from "@medivi/db/queries";
import { getSession, requireUser } from "@/lib/auth-guards";
import { resolveOwnerForMutation, resolveOwnerForRead } from "@/lib/cart-owner";
import { clearGuestCartCookie, readGuestCartToken } from "@/lib/guest-cart-cookie";
import { getOrCreateAnalyticsSessionId } from "@/lib/analytics-session";

const addToCartSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(99),
});

export async function addToCartAction(
  input: z.infer<typeof addToCartSchema>,
): Promise<AddToCartResult> {
  const { variantId, quantity } = addToCartSchema.parse(input);
  const owner = await resolveOwnerForMutation();
  const result = await addCartItem(db, owner, variantId, quantity);
  if (result.ok) {
    revalidatePath("/", "layout");
    const [sessionId, session] = await Promise.all([getOrCreateAnalyticsSessionId(), getSession()]);
    await recordAnalyticsEvent(db, {
      sessionId,
      userId: session?.user.id,
      type: "add_to_cart",
      metadata: { variantId, quantity },
    });
  }
  return result;
}

const updateQuantitySchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(0).max(99),
});

export async function updateCartItemAction(
  input: z.infer<typeof updateQuantitySchema>,
): Promise<UpdateQuantityResult> {
  const { itemId, quantity } = updateQuantitySchema.parse(input);
  const owner = await resolveOwnerForRead();
  if (!owner) return { ok: true };

  const result = await updateCartItemQuantity(db, owner, itemId, quantity);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

const removeItemSchema = z.object({ itemId: z.string().uuid() });

export async function removeCartItemAction(input: z.infer<typeof removeItemSchema>): Promise<void> {
  const { itemId } = removeItemSchema.parse(input);
  const owner = await resolveOwnerForRead();
  if (!owner) return;

  await removeCartItem(db, owner, itemId);
  revalidatePath("/", "layout");
}

/** Called right after a successful sign-in/sign-up so a guest cart isn't stranded under the old cookie. */
export async function mergeCartOnLogin(): Promise<void> {
  const user = await requireUser();
  const guestToken = await readGuestCartToken();
  if (!guestToken) return;

  await mergeGuestCartIntoUserCart(db, guestToken, user.id);
  await clearGuestCartCookie();
  revalidatePath("/", "layout");
}
