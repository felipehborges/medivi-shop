"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@medivi/ui/lib/utils";
import { useLocale } from "./locale-provider";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/banners", label: "Banners" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit-log", label: "Audit Log" },
  { href: "/admin/users", label: "Users" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const { tr } = useLocale();

  return (
    <nav aria-label={tr("Admin navigation")} className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const isActive = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
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
