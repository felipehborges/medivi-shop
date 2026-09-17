import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";

import { getCurrentCartDetail } from "@/lib/cart";
import { CartLineItem } from "@/components/cart-line-item";
import { CartSummary } from "@/components/cart-summary";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Cart — Medivi Shop",
};

export default async function CartPage() {
  const cart = await getCurrentCartDetail();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-display text-3xl"><LocalizedText text={"Your Cart"} /></h1>

      {cart.items.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          description="Add something from the catalog to get started."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            {cart.items.map((item) => (
              <CartLineItem key={item.id} item={item} />
            ))}
          </div>
          <CartSummary subtotalCents={cart.subtotalCents} />
        </div>
      )}
    </div>
  );
}
