"use client";
import Link from "next/link";
import {
  products,
  findRecord,
  findVariant,
  departments,
  artifactRecords,
} from "@/lib/catalog";
import { useDemo } from "./demo-provider";
import { useI18n } from "./locale-provider";
import { Heading, Mark } from "./armory";
export function AdminView() {
  const { copy, language, tr, formatMoney } = useI18n();
  const { state, toggleProduct, reset, hydrated } = useDemo();
  const ordered = [...products].sort(
    (a, b) =>
      artifactRecords.findIndex((r) => r.slug === a.slug) -
      artifactRecords.findIndex((r) => r.slug === b.slug),
  );
  const onFloor = ordered.filter(
    (product) => !state.hiddenProducts.includes(product.slug),
  );
  const stockOf = (product: (typeof products)[number]) =>
    product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  const metrics = [
    { label: copy.statWares, value: onFloor.length, mark: "knot" },
    {
      label: copy.statStock,
      value: onFloor.reduce((sum, p) => sum + stockOf(p), 0),
      mark: "anvil",
    },
    {
      label: copy.statLow,
      value: onFloor.filter((p) => stockOf(p) <= 4).length,
      mark: "flame",
    },
    {
      label: copy.statValue,
      value: formatMoney(
        onFloor.reduce(
          (sum, p) =>
            sum +
            p.variants.reduce(
              (n, v) => n + (v.priceCents ?? p.priceCents) * v.stock,
              0,
            ),
          0,
        ),
      ),
      mark: "coins",
    },
  ];
  return (
    <div className="armory-shell armory-page admin-page">
      <Heading title={copy.adminTitle} subtitle={copy.adminSub} mark="coins" />
      <div className="stat-grid">
        {metrics.map((metric) => (
          <div className="plate stat-plate" key={metric.label}>
            <div className="stat-label caption">
              <Mark name={metric.mark} tone="bone" size={17} />
              {metric.label}
            </div>
            <p className="stat-value">{metric.value}</p>
          </div>
        ))}
      </div>
      <div className="plate">
        <table className="ledger-table">
          <caption className="sr-only">{copy.adminTitle}</caption>
          <thead>
            <tr>
              {[
                copy.colWare,
                copy.colDept,
                copy.colStock,
                copy.colEach,
                copy.colState,
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {onFloor.map((product) => {
              const record = findRecord(product.slug);
              const dept = departments.find((d) => d.slug === record?.dept);
              const spoken = state.cart.some(
                (item) =>
                  findVariant(item.variantId)?.product.slug === product.slug,
              );
              const low = stockOf(product) <= 4;
              return (
                <tr key={product.slug}>
                  <td data-label={copy.colWare}>
                    <Link href={`/product/${product.slug}`}>
                      <Mark name={dept?.mark ?? "knot"} tone="bone" size={17} />
                      {record?.[language].name ?? tr(product.name)}
                    </Link>
                  </td>
                  <td data-label={copy.colDept}>{dept?.[language].name}</td>
                  <td data-label={copy.colStock}>{stockOf(product)}</td>
                  <td data-label={copy.colEach}>
                    {formatMoney(product.priceCents)}
                  </td>
                  <td data-label={copy.colState}>
                    <span
                      className={`state-chip ${spoken ? "state-spoken" : low ? "state-low" : ""}`}
                    >
                      {spoken
                        ? copy.stateSpoken
                        : low
                          ? copy.stateLow
                          : copy.stateOnFloor}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <details className="plate admin-tools">
        <summary>{tr("Catalog visibility")}</summary>
        <div className="action-row">
          {ordered.map((product) => (
            <button
              key={product.slug}
              className="filter-plate"
              disabled={!hydrated}
              aria-pressed={!state.hiddenProducts.includes(product.slug)}
              onClick={() => toggleProduct(product.slug)}
            >
              {findRecord(product.slug)?.[language].name ?? tr(product.name)} ·{" "}
              {tr(
                state.hiddenProducts.includes(product.slug)
                  ? "Hidden"
                  : "Visible",
              )}
            </button>
          ))}
        </div>
      </details>
      <details className="plate admin-tools">
        <summary>{tr("Recent demo orders")}</summary>
        {state.orders.map((order) => (
          <p key={order.id}>
            <Link
              className="text-action"
              href={`/order/confirmation?id=${encodeURIComponent(order.id)}`}
            >
              {order.id} · {formatMoney(order.totalCents)}
            </Link>
          </p>
        ))}
        <button className="text-action" onClick={reset} disabled={!hydrated}>
          {tr("Restore defaults")}
        </button>
      </details>
    </div>
  );
}
