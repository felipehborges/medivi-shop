"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@medivi/ui/lib/utils";
import { useLocale } from "./locale-provider";

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Order history" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/wishlist", label: "Wishlist" },
] as const;

export function AccountNav() {
  const pathname = usePathname();
  const { tr } = useLocale();

  return (
    <nav aria-label={tr("Account navigation")} className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const isActive = link.href === "/account" ? pathname === "/account" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm hover:bg-muted",
              isActive ? "bg-muted font-medium" : "text-muted-foreground",
            )}
          >
            {tr(link.label)}
          </Link>
        );
      })}
    </nav>
  );
}
