import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@medivi/db/client";
import {
  conversionFunnel,
  listOrdersAdmin,
  lowStockAlerts,
  revenueOverTime,
  topProductsByRevenue,
} from "@medivi/db/queries";
import { Badge } from "@medivi/ui/components/ui/badge";
import { requireAdmin } from "@/lib/auth-guards";
import { formatPriceCents } from "@/lib/format";

export const metadata: Metadata = { title: "Analytics — Admin — Medivi Shop" };

function FunnelStep({ label, count, ofTotal }: { label: string; count: number; ofTotal: number }) {
  const pct = ofTotal > 0 ? Math.round((count / ofTotal) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {count} {ofTotal > 0 && `(${pct}%)`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(count > 0 ? 2 : 0, pct)}%` }} />
      </div>
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  await requireAdmin();

  const [revenue, topProducts, lowStock, recentOrders, funnel] = await Promise.all([
    revenueOverTime(db, 30),
    topProductsByRevenue(db, 5),
    lowStockAlerts(db, 5),
    listOrdersAdmin(db, { pageSize: 10 }),
    conversionFunnel(db, 30),
  ]);

  const maxRevenueCents = Math.max(1, ...revenue.map((r) => r.revenueCents));
  const totalRevenueCents = revenue.reduce((sum, r) => sum + r.revenueCents, 0);
  const totalOrders = revenue.reduce((sum, r) => sum + r.orderCount, 0);
  const averageOrderValueCents = totalOrders > 0 ? Math.round(totalRevenueCents / totalOrders) : 0;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl">Analytics</h1>

      <section className="flex flex-col gap-4 rounded-xl border p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-xl">Revenue — last 30 days</h2>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="font-display text-2xl">{formatPriceCents(totalRevenueCents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Orders</p>
              <p className="font-display text-2xl">{totalOrders}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg. order value</p>
              <p className="font-display text-2xl">{formatPriceCents(averageOrderValueCents)}</p>
            </div>
          </div>
        </div>
        {revenue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No paid orders in this window yet.</p>
        ) : (
          <div className="flex h-32 items-end gap-1" aria-hidden="true">
            {revenue.map((point) => (
              <div
                key={point.date}
                title={`${point.date}: ${formatPriceCents(point.revenueCents)} (${point.orderCount} orders)`}
                className="flex-1 rounded-sm bg-primary/70"
                style={{ height: `${Math.max(4, (point.revenueCents / maxRevenueCents) * 100)}%` }}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-xl border p-6">
          <h2 className="font-display text-xl">Top products</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-1">Product</th>
                  <th className="py-1">Units</th>
                  <th className="py-1">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.productId} className="border-b last:border-0">
                    <td className="py-2">
                      <Link href={`/admin/products/${p.productId}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2">{p.unitsSold}</td>
                    <td className="py-2">{formatPriceCents(p.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-xl border p-6">
          <h2 className="font-display text-xl">Low stock</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing running low.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {lowStock.map((v) => (
                <li key={v.variantId} className="flex items-center justify-between">
                  <Link href={`/admin/products/${v.productId}`} className="hover:underline">
                    {v.productName} — {v.variantName}
                  </Link>
                  <Badge variant={v.stock === 0 ? "destructive" : "secondary"}>{v.stock} left</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-4 rounded-xl border p-6">
        <h2 className="font-display text-xl">Conversion funnel — last 30 days</h2>
        <p className="text-xs text-muted-foreground">
          Distinct visitor sessions reaching each step, not raw event counts.
        </p>
        {funnel.pageViews === 0 ? (
          <p className="text-sm text-muted-foreground">No visits recorded in this window yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <FunnelStep label="Page views" count={funnel.pageViews} ofTotal={funnel.pageViews} />
            <FunnelStep label="Added to cart" count={funnel.addToCart} ofTotal={funnel.pageViews} />
            <FunnelStep label="Checkout started" count={funnel.checkoutStarted} ofTotal={funnel.pageViews} />
            <FunnelStep label="Checkout completed" count={funnel.checkoutCompleted} ofTotal={funnel.pageViews} />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border p-6">
        <h2 className="font-display text-xl">Recent orders</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {recentOrders.items.map((o) => (
            <li key={o.id} className="flex items-center justify-between border-b py-1 last:border-0">
              <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                {o.orderNumber}
              </Link>
              <span className="text-muted-foreground">{o.customer}</span>
              <Badge variant="outline" className="capitalize">
                {o.status}
              </Badge>
              <span>{formatPriceCents(o.totalCents, o.currency)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
