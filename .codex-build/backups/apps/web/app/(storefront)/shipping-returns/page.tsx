import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping & Returns — Medivi Shop",
};

export default function ShippingReturnsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display mb-4 text-3xl">Shipping &amp; Returns</h1>
      <p className="text-muted-foreground">
        Medivi Shop is a fictional portfolio project. This page is a placeholder — no real
        shipping or returns policy applies, since no physical goods are ever shipped.
      </p>
    </div>
  );
}
