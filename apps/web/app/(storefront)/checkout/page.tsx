import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";

import { getCurrentCartDetail } from "@/lib/cart";
import { getSession } from "@/lib/auth-guards";
import { CheckoutForm } from "@/components/checkout-form";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Checkout — Medivi Shop",
};

export default async function CheckoutPage() {
  const [cart, session] = await Promise.all([getCurrentCartDetail(), getSession()]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 font-display text-3xl"><LocalizedText text={"Checkout"} /></h1>

      {cart.items.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          description="Add something from the catalog before checking out."
        />
      ) : (
        <CheckoutForm cart={cart} userEmail={session?.user.email ?? null} />
      )}
    </div>
  );
}
