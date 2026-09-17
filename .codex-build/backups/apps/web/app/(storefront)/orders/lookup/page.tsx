import type { Metadata } from "next";

import { OrderLookupForm } from "@/components/order-lookup-form";

export const metadata: Metadata = {
  title: "Find your order — Medivi Shop",
};

export default function OrderLookupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 font-display text-3xl">Find your order</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Enter your order number and the email you used at checkout.
      </p>
      <OrderLookupForm />
    </div>
  );
}
