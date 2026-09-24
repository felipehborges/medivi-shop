"use client";
import Link from "next/link";
import { useState } from "react";
import {
  departments,
  findRecord,
  rarityLabels,
  type Product,
} from "@/lib/catalog";
import { useDemo } from "./demo-provider";
import { useI18n } from "./locale-provider";
import { Mark, SectionHeading } from "./armory";
import { ProductCard } from "./product-card";
import { ProductImageGallery } from "./product-image-gallery";
import { DemoNotice } from "./site-header";
export function ProductDetail({
  product,
  related,
}: {
  product: Product;
  related: Product[];
}) {
  return (
    <ArtifactDetail key={product.slug} product={product} related={related} />
  );
}
function ArtifactDetail({
  product,
  related,
}: {
  product: Product;
  related: Product[];
}) {
  const { copy, language, tr, formatMoney } = useI18n();
  const { state, hydrated, addToCart, toggleWishlist } = useDemo();
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const variant = product.variants.find((item) => item.id === variantId);
  const stock = variant?.stock ?? 0;
  const record = findRecord(product.slug);
  const info = record?.[language];
  const dept = departments.find((item) => item.slug === record?.dept);
  const wished = state.wishlist.includes(product.slug);
  const rows = [
    {
      mark: "anvil",
      label: copy.recMaterial,
      value: info?.material ?? tr(product.material),
    },
    { mark: "shield", label: copy.recOrigin, value: info?.origin },
    { mark: "flame", label: copy.recEra, value: info?.era },
    { mark: "coins", label: copy.recWeight, value: info?.weight },
    { mark: "knot", label: copy.recStock, value: String(stock) },
  ];
  return (
    <>
      <div className="armory-shell detail-page">
        <Link href="/catalog" className="back-link">
          ← {copy.backToFloor}
        </Link>
        <div className="detail-grid">
          <div>
            <ProductImageGallery
              src={product.image}
              alt={info?.name ?? tr(product.name)}
            />
            <dl className="record-table">
              {rows
                .filter((row) => row.value)
                .map((row) => (
                  <div className="record-row" key={row.label}>
                    <Mark name={row.mark} tone="bone" size={15} />
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
            </dl>
          </div>
          <div className="detail-copy">
            {record && (
              <p className="eyebrow">
                {rarityLabels[language][record.rar]} · {dept?.[language].name}
              </p>
            )}
            <h1>{info?.name ?? tr(product.name)}</h1>
            <p className="detail-description">
              {info?.description ?? tr(product.description)}
            </p>
            <div className="heading-rule detail-rule">
              <span className="rule" />
              <Mark name="knot" />
              <span className="rule" />
            </div>
            {info && (
              <>
                <div className="maker">
                  <Mark name="anvil" tone="bone" size={30} />
                  <div>
                    <p className="eyebrow">{copy.forgedBy}</p>
                    <p className="maker-name">{info.maker}</p>
                    <p className="maker-note">{info.makerNote}</p>
                  </div>
                </div>
                <aside className="parchment merchant-note">
                  <p className="caption">{copy.merchantsNote}</p>
                  <p>{info.note}</p>
                </aside>
              </>
            )}
            {product.variants.length > 1 && (
              <fieldset className="form-section">
                <legend className="caption">{tr("Choose a variant")}</legend>
                <div className="filter-row">
                  {product.variants.map((item) => (
                    <button
                      key={item.id}
                      className="filter-plate"
                      aria-pressed={item.id === variantId}
                      onClick={() => {
                        setVariantId(item.id);
                        setQty(1);
                      }}
                    >
                      {tr(item.name)}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="buy-price">
              <div>
                <p className="caption">{copy.merchantsPrice}</p>
                <p className="large-price">
                  {formatMoney(variant?.priceCents ?? product.priceCents)}
                </p>
              </div>
              <div className="stepper" role="group" aria-label={copy.colCount}>
                <button
                  aria-label={tr("Decrease quantity")}
                  disabled={qty <= 1}
                  onClick={() => setQty(qty - 1)}
                >
                  −
                </button>
                <output aria-live="polite">{qty}</output>
                <button
                  aria-label={tr("Increase quantity")}
                  disabled={qty >= stock}
                  onClick={() => setQty(qty + 1)}
                >
                  +
                </button>
              </div>
            </div>
            <div className="buy-actions">
              <button
                className="forged"
                disabled={!hydrated || !variant || stock < 1}
                onClick={() => addToCart(variantId, qty)}
              >
                <Mark name="coins" tone="bone" />
                {copy.addToSatchel}
              </button>
              <button
                className="forged forged-secondary"
                disabled={!hydrated}
                aria-pressed={wished}
                onClick={() => toggleWishlist(product.slug)}
              >
                <Mark name="feather" tone="bone" />
                {wished ? copy.watching : copy.watch}
              </button>
            </div>
            <p className="stock-line">
              {stock} {copy.stockLine}
            </p>
            <DemoNotice compact />
          </div>
        </div>
      </div>
      <section className="same-shelf">
        <div className="armory-shell">
          <SectionHeading>{copy.sameShelf}</SectionHeading>
          <div className="simple-grid">
            {related
              .filter((item) => !state.hiddenProducts.includes(item.slug))
              .slice(0, 3)
              .map((item) => (
                <ProductCard product={item} simple key={item.slug} />
              ))}
          </div>
        </div>
      </section>
    </>
  );
}
