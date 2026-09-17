"use client";

import { LocalizedText } from "@/components/localized-text";


import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@medivi/ui/components/ui/button";
import { Input } from "@/components/translated-input";
import { Label } from "@medivi/ui/components/ui/label";
import type { AdminProductVariant } from "@medivi/db/queries";
import { formatPriceCents } from "@/lib/format";
import {
  adjustStockAction,
  createVariantAction,
  deleteVariantAction,
} from "@/lib/actions/admin-variants";

function VariantStockControl({ productId, variant }: { productId: string; variant: AdminProductVariant }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function adjust(reason: "restock" | "adjustment", sign: 1 | -1) {
    const delta = Number(amount) * sign;
    if (!Number.isInteger(delta) || delta === 0) {
      setError("Enter a non-zero whole number");
      return;
    }
    setError(null);
    setPending(true);
    const result = await adjustStockAction({ productId, variantId: variant.id, delta, reason });
    setPending(false);
    if (!result.ok) {
      setError(result.reason === "would_go_negative" ? "Not enough stock for that adjustment" : "Variant not found");
      return;
    }
    setAmount("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          inputMode="numeric"
          placeholder="Qty"
          className="w-20"
        />
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => adjust("restock", 1)}>
          <LocalizedText text={"Restock + "} /></Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => adjust("adjustment", -1)}>
          <LocalizedText text={"Adjust − "} /></Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function VariantManager({ productId, variants }: { productId: string; variants: AdminProductVariant[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createVariantAction({
        productId,
        name,
        sku,
        priceOverrideCents: priceOverride ? Number(priceOverride) : undefined,
      });
      setName("");
      setSku("");
      setPriceOverride("");
      router.refresh();
    } catch {
      setError("Could not add variant — check the SKU is unique.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    const result = await deleteVariantAction({ id, productId });
    if (!result.ok) {
      setError(result.reason === "has_orders" ? "Can't delete a variant that has been ordered." : "Variant not found.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-6">
      <h2 className="font-display text-xl"><LocalizedText text={"Variants"} /></h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-left">
            <tr>
              <th className="p-2"><LocalizedText text={"Name"} /></th>
              <th className="p-2"><LocalizedText text={"SKU"} /></th>
              <th className="p-2"><LocalizedText text={"Price override"} /></th>
              <th className="p-2"><LocalizedText text={"Stock"} /></th>
              <th className="p-2"><LocalizedText text={"Adjust stock"} /></th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <tr key={variant.id} className="border-b last:border-0 align-top">
                <td className="p-2">{variant.name}</td>
                <td className="p-2 text-muted-foreground">{variant.sku}</td>
                <td className="p-2">{variant.priceOverrideCents != null ? formatPriceCents(variant.priceOverrideCents) : "—"}</td>
                <td className="p-2">{variant.stock}</td>
                <td className="p-2">
                  <VariantStockControl productId={productId} variant={variant} />
                </td>
                <td className="p-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onDelete(variant.id)}>
                    <LocalizedText text={"Delete "} /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={onAdd} className="flex flex-wrap items-end gap-3 border-t pt-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="variant-name"><LocalizedText text={"Name"} /></Label>
          <Input id="variant-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="variant-sku"><LocalizedText text={"SKU"} /></Label>
          <Input id="variant-sku" value={sku} onChange={(e) => setSku(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="variant-price"><LocalizedText text={"Price override (cents)"} /></Label>
          <Input
            id="variant-price"
            type="number"
            inputMode="numeric"
            value={priceOverride}
            onChange={(e) => setPriceOverride(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <Button type="submit" disabled={pending}>
          <LocalizedText text={"Add variant "} /></Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
