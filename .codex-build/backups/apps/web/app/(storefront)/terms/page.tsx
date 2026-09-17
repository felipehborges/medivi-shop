import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Medivi Shop",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display mb-4 text-3xl">Terms of Service</h1>
      <p className="text-muted-foreground">
        Medivi Shop is a fictional portfolio project. This page is a placeholder — no real
        terms of service apply, since no real transactions take place here.
      </p>
    </div>
  );
}
