"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@medivi/db/client";
import { addToWishlist, removeFromWishlist } from "@medivi/db/queries";
import { requireUser } from "@/lib/auth-guards";

const toggleWishlistSchema = z.object({
  productId: z.string().uuid(),
  action: z.enum(["add", "remove"]),
});

export async function toggleWishlist(input: z.infer<typeof toggleWishlistSchema>) {
  const user = await requireUser();
  const { productId, action } = toggleWishlistSchema.parse(input);

  if (action === "add") {
    await addToWishlist(db, user.id, productId);
  } else {
    await removeFromWishlist(db, user.id, productId);
  }

  revalidatePath("/wishlist");
}
