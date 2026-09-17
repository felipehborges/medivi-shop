import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Medivi Shop",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display mb-4 text-3xl"><LocalizedText text={"Privacy Policy"} /></h1>
      <p className="text-muted-foreground">
        <LocalizedText text={"Medivi Shop is a fictional portfolio project. This page is a placeholder — no real data-collection policy applies, since no real personal data is processed here. "} /></p>
    </div>
  );
}
