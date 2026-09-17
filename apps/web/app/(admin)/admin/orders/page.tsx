import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@medivi/db/client";
import { listOrdersAdmin } from "@medivi/db/queries";
import { Badge } from "@medivi/ui/components/ui/badge";
import { Button } from "@medivi/ui/components/ui/button";
import type { OrderStatus } from "@medivi/db/schema";
import { requireAdmin } from "@/lib/auth-guards";
import { formatPriceCents } from "@/lib/format";
import { CatalogPagination } from "@/components/catalog-pagination";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Orders — Admin — Medivi Shop" };

const STATUSES: OrderStatus[] = ["pending", "paid", "fulfilled", "cancelled", "refunded"];

type Params = { status?: string; page?: string };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status);
  const result = await listOrdersAdmin(db, { status, page: params.page ? Number(params.page) : 1 });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl"><LocalizedText text={"Orders"} /></h1>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant={!status ? "default" : "outline"} size="sm">
          <Link href="/admin/orders"><LocalizedText text={"All"} /></Link>
        </Button>
        {STATUSES.map((s) => (
          <Button key={s} asChild variant={status === s ? "default" : "outline"} size="sm">
            <Link href={`/admin/orders?status=${s}`} className="capitalize">
              {s}
            </Link>
          </Button>
        ))}
      </div>

      {result.items.length === 0 ? (
        <EmptyState title="No orders match" description="Try a different status filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3"><LocalizedText text={"Order"} /></th>
                <th className="p-3"><LocalizedText text={"Customer"} /></th>
                <th className="p-3"><LocalizedText text={"Total"} /></th>
                <th className="p-3"><LocalizedText text={"Status"} /></th>
                <th className="p-3"><LocalizedText text={"Placed"} /></th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="p-3">
                    <Link href={`/admin/orders/${item.id}`} className="font-medium hover:underline">
                      {item.orderNumber}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{item.customer}</td>
                  <td className="p-3">{formatPriceCents(item.totalCents, item.currency)}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="capitalize">
                      {item.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{item.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CatalogPagination
        basePath="/admin/orders"
        page={result.page}
        totalPages={result.totalPages}
        searchParams={{ status: params.status }}
      />
    </div>
  );
}
