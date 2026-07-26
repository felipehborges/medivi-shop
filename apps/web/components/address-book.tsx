"use client";

import { useState, useTransition } from "react";

import { Badge } from "@medivi/ui/components/ui/badge";
import { Button } from "@medivi/ui/components/ui/button";
import type { Address } from "@medivi/db/queries";
import { deleteAddressAction } from "@/lib/actions/addresses";
import { AddressForm } from "./address-form";

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(() => deleteAddressAction({ id }));
  }

  return (
    <div className="flex flex-col gap-4">
      {addresses.map((a) =>
        editingId === a.id ? (
          <AddressForm key={a.id} address={a} onDone={() => setEditingId(null)} />
        ) : (
          <div key={a.id} className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <div>
              {a.isDefault && <Badge variant="outline" className="mb-1">Default</Badge>}
              <p className="font-medium">{a.fullName}</p>
              <p className="text-sm text-muted-foreground">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {a.city}, {a.region} {a.postalCode}
              </p>
              <p className="text-sm text-muted-foreground">{a.country}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(a.id)}>
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => handleDelete(a.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ),
      )}

      {editingId === "new" ? (
        <AddressForm onDone={() => setEditingId(null)} />
      ) : (
        <Button type="button" variant="outline" onClick={() => setEditingId("new")}>
          Add address
        </Button>
      )}
    </div>
  );
}
