"use client";
import Link from "next/link";
import { type Product, findRecord, rarityLabels } from "@/lib/catalog";
import { Mark, ProductFrame, Roman } from "./armory";
import { useI18n } from "./locale-provider";
export function ProductCard({
  product,
  simple = false,
}: {
  product: Product;
  simple?: boolean;
}) {
  const { copy, language, tr, formatMoney } = useI18n();
  const record = findRecord(product.slug);
  const info = record?.[language];
  return (
    <article className="ware-card">
      <Link
        href={`/product/${product.slug}`}
        aria-label={info?.name ?? tr(product.name)}
      >
        <ProductFrame src={product.image} alt={info?.name ?? tr(product.name)}>
          {!simple && (
            <>
              <span className="iron-spine" aria-hidden="true" />
              {record && (
                <span
                  className="wax-seal"
                  aria-label={rarityLabels[language][record.rar]}
                >
                  <Roman value={record.rar} />
                </span>
              )}
            </>
          )}
        </ProductFrame>
        <div className="ware-body">
          {!simple && record && (
            <p className="eyebrow">{rarityLabels[language][record.rar]}</p>
          )}
          <h3>{info?.name ?? tr(product.name)}</h3>
          {!simple && (
            <>
              <p className="ware-description">
                {info?.description ?? tr(product.description)}
              </p>
              <div className="artifact-marks">
                <span>
                  <Mark name="anvil" tone="bone" size={16} />
                  {info?.material ?? tr(product.material)}
                </span>
                {info && (
                  <>
                    <span>
                      <Mark name="scroll" tone="bone" size={16} />
                      {info.origin}
                    </span>
                    <span>
                      <Mark name="flame" tone="bone" size={16} />
                      {info.era}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
          <div className="ware-bottom">
            <span className="ware-price">
              {formatMoney(product.priceCents)}
            </span>
            {!simple && (
              <span className="ware-link">{copy.viewArtifact} →</span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
