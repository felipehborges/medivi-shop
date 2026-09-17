import { LocalizedText } from "@/components/localized-text";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@medivi/db/client";
import { listProductsAdmin, type AdminProductListParams } from "@medivi/db/queries";
import { Button } from "@medivi/ui/components/ui/button";
import { Badge } from "@medivi/ui/components/ui/badge";
import { Input } from "@/components/translated-input";
import { requireAdmin } from "@/lib/auth-guards";
import { formatPriceCents } from "@/lib/format";
import { CatalogPagination } from "@/components/catalog-pagination";
import { ProductStatusButton } from "@/components/admin/product-status-button";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Products — Admin — Medivi Shop" };

type Params = { search?: string; status?: string; page?: string };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const params = await searchParams;
  const status = params.status === "draft" || params.status === "active" || params.status === "archived" ? params.status : undefined;
  const listParams: AdminProductListParams = {
    search: params.search || undefined,
    status,
    page: params.page ? Number(params.page) : 1,
  };
  const result = await listProductsAdmin(db, listParams);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl"><LocalizedText text={"Products"} /></h1>
        <Button asChild>
          <Link href="/admin/products/new"><LocalizedText text={"New product"} /></Link>
        </Button>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="search" className="text-xs text-muted-foreground">
            <LocalizedText text={"Search "} /></label>
          <Input id="search" name="search" defaultValue={params.search} placeholder="Product name…" className="w-56" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-xs text-muted-foreground">
            <LocalizedText text={"Status "} /></label>
          <select
            id="status"
            name="status"
            defaultValue={params.status ?? ""}
            className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none dark:bg-input/30"
          >
            <option value=""><LocalizedText text={"All"} /></option>
            <option value="draft"><LocalizedText text={"Draft"} /></option>
            <option value="active"><LocalizedText text={"Active"} /></option>
            <option value="archived"><LocalizedText text={"Archived"} /></option>
          </select>
        </div>
        <Button type="submit" size="sm">
          <LocalizedText text={"Filter "} /></Button>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/admin/products"><LocalizedText text={"Clear"} /></Link>
        </Button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState title="No products match" description="Try a different search term or clear the filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3"><LocalizedText text={"Product"} /></th>
                <th className="p-3"><LocalizedText text={"Category"} /></th>
                <th className="p-3"><LocalizedText text={"Price"} /></th>
                <th className="p-3"><LocalizedText text={"Stock"} /></th>
                <th className="p-3"><LocalizedText text={"Status"} /></th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="p-3">
                    <Link href={`/admin/products/${item.id}`} className="font-medium hover:underline">
                      {item.name}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{item.categoryName}</td>
                  <td className="p-3">{formatPriceCents(item.basePriceCents)}</td>
                  <td className="p-3">{item.totalStock}</td>
                  <td className="p-3">
                    <Badge variant={item.status === "active" ? "default" : item.status === "archived" ? "destructive" : "secondary"}>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <ProductStatusButton id={item.id} status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CatalogPagination
        basePath="/admin/products"
        page={result.page}
        totalPages={result.totalPages}
        searchParams={{ search: params.search, status: params.status }}
      />
    </div>
  );
}
