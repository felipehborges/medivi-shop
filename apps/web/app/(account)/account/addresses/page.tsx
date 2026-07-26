import type { Metadata } from "next";

import { db } from "@medivi/db/client";
import { listAddressesForUser } from "@medivi/db/queries";
import { requireUser } from "@/lib/auth-guards";
import { AddressBook } from "@/components/address-book";

export const metadata: Metadata = {
  title: "Addresses — Medivi Shop",
};

export default async function AddressesPage() {
  const user = await requireUser();
  const addresses = await listAddressesForUser(db, user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">Addresses</h1>
      <AddressBook addresses={addresses} />
    </div>
  );
}
