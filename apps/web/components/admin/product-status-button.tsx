"use client";

import { LocalizedText } from "@/components/localized-text";


import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@medivi/ui/components/ui/button";
import type { ProductStatus } from "@medivi/db/schema";
import { setProductStatusAction } from "@/lib/actions/admin-products";

export function ProductStatusButton({ id, status }: { id: string; status: ProductStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setStatus(next: ProductStatus) {
    setPending(true);
    await setProductStatusAction({ id, status: next });
    setPending(false);
    router.refresh();
  }

  if (status === "archived") {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("draft")}>
        <LocalizedText text={"Restore "} /></Button>
    );
  }
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("archived")}>
      <LocalizedText text={"Archive "} /></Button>
  );
}
