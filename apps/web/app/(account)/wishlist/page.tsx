import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";

import { db } from "@medivi/db/client";
import { listWishlistProducts } from "@medivi/db/queries";
import { requireUser } from "@/lib/auth-guards";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Wishlist — Medivi Shop",
};

export default async function WishlistPage() {
  const user = await requireUser();
  const products = await listWishlistProducts(db, user.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 font-display text-3xl"><LocalizedText text={"Your Wishlist"} /></h1>

      {products.length === 0 ? (
        <EmptyState
          title="Your wishlist is empty"
          description="Save products you're eyeing by tapping the heart on any item."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} showWishlistButton isWishlisted />
          ))}
        </div>
      )}
    </div>
  );
}
