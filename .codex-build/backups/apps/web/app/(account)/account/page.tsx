import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth-guards";

export const metadata: Metadata = {
  title: "Account — Medivi Shop",
};

export default async function AccountOverviewPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl">Welcome, {user.name}</h1>
        <p className="text-muted-foreground">{user.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/account/orders"
          className="rounded-xl border p-6 transition-colors hover:bg-muted"
        >
          <p className="font-display text-lg">Order history</p>
          <p className="text-sm text-muted-foreground">Track and review your past orders.</p>
        </Link>
        <Link
          href="/account/addresses"
          className="rounded-xl border p-6 transition-colors hover:bg-muted"
        >
          <p className="font-display text-lg">Addresses</p>
          <p className="text-sm text-muted-foreground">Manage your saved shipping addresses.</p>
        </Link>
      </div>
    </div>
  );
}
