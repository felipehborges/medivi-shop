import { db } from "@medivi/db/client";
import { getCartDetail, type CartDetail } from "@medivi/db/queries";
import { resolveOwnerForRead } from "./cart-owner";

const EMPTY_CART: CartDetail = { id: null, items: [], subtotalCents: 0, itemCount: 0 };

export async function getCurrentCartDetail(): Promise<CartDetail> {
  const owner = await resolveOwnerForRead();
  if (!owner) return EMPTY_CART;
  return getCartDetail(db, owner);
}
