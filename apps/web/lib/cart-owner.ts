import "server-only";
import type { CartOwner } from "@medivi/db/queries";
import { getSession } from "./auth-guards";
import { getOrCreateGuestCartToken, readGuestCartToken } from "./guest-cart-cookie";

/** For mutations — mints a guest cart cookie if the visitor doesn't have one yet. */
export async function resolveOwnerForMutation(): Promise<CartOwner> {
  const session = await getSession();
  if (session) return { userId: session.user.id };
  return { guestToken: await getOrCreateGuestCartToken() };
}

/** For reads — never mints a cookie; no cookie means no cart yet. */
export async function resolveOwnerForRead(): Promise<CartOwner | null> {
  const session = await getSession();
  if (session) return { userId: session.user.id };
  const guestToken = await readGuestCartToken();
  return guestToken ? { guestToken } : null;
}
