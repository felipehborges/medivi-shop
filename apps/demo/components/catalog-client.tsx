"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { artifactRecords, departments, findRecord } from "@/lib/catalog";
import { visibleProducts } from "@/lib/store";
import { ProductCard } from "./product-card";
import { useDemo } from "./demo-provider";
import { useI18n } from "./locale-provider";
import { Heading, Mark } from "./armory";
export function CatalogClient() {
  const params = useSearchParams();
  return (
    <CatalogContents
      key={params.toString()}
      department={params.get("department") ?? "all"}
      category={params.get("category")}
      initialQuery={params.get("q") ?? ""}
    />
  );
}
function CatalogContents({
  department,
  category,
  initialQuery,
}: {
  department: string;
  category: string | null;
  initialQuery: string;
}) {
  const { copy, language, tr } = useI18n();
  const { state } = useDemo();
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState("curated");
  const dept = departments.find((item) => item.slug === department);
  const filtered = visibleProducts(state)
    .filter((product) => {
      const record = findRecord(product.slug);
      const info = record?.[language];
      return (
        (!dept || record?.dept === dept.slug) &&
        (!category || product.category === category) &&
        `${product.name} ${info?.name ?? tr(product.name)} ${product.material} ${info?.material ?? ""} ${info?.origin ?? ""}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase())
      );
    })
    .sort((a, b) =>
      sort === "low"
        ? a.priceCents - b.priceCents
        : sort === "high"
          ? b.priceCents - a.priceCents
          : artifactRecords.findIndex((r) => r.slug === a.slug) -
            artifactRecords.findIndex((r) => r.slug === b.slug),
    );
  return (
    <div className="armory-shell armory-page">
      <div className="shop-head">
        <Heading
          eyebrow={copy.shopEyebrow}
          title={dept?.[language].name ?? copy.allWares}
          subtitle={dept?.[language].description ?? copy.departmentsNote}
        />
        <div className="search-field">
          <label className="eyebrow" htmlFor="search">
            {copy.askTheMerchant}
          </label>
          <input
            id="search"
            className="sunken"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </div>
      </div>
      <nav className="filter-row" aria-label={copy.navDepartments}>
        <Link
          href="/catalog"
          scroll={false}
          className="filter-plate"
          aria-current={!dept && !category ? "true" : undefined}
        >
          <Mark name="knot" tone="bone" />
          {copy.allWares}
        </Link>
        {departments.map((item) => (
          <Link
            key={item.slug}
            href={`/catalog?department=${item.slug}`}
            scroll={false}
            className="filter-plate"
            aria-current={dept?.slug === item.slug ? "true" : undefined}
          >
            <Mark name={item.mark} tone="bone" />
            {item[language].name}
          </Link>
        ))}
      </nav>
      <div className="results-row">
        <p role="status">
          {filtered.length} {copy.wares}
        </p>
        <select
          aria-label={tr("Sort products")}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="curated">{tr("Featured first")}</option>
          <option value="low">{tr("Price: low to high")}</option>
          <option value="high">{tr("Price: high to low")}</option>
        </select>
      </div>
      {filtered.length ? (
        <div className="wares-grid">
          {filtered.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty-panel">
          <Mark name="rune" tone="bone" size={40} />
          <h2>{copy.noneFound}</h2>
          <p>{copy.noneFoundSub}</p>
        </div>
      )}
    </div>
  );
}
