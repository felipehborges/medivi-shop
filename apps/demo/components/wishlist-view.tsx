"use client";
import Link from "next/link";
import { products, findRecord } from "@/lib/catalog";
import { useDemo } from "./demo-provider";
import { useI18n } from "./locale-provider";
import { Heading, Mark, ProductFrame } from "./armory";
export function WishlistView() {
  const { copy, language, tr, formatMoney } = useI18n();
  const { state, hydrated, addToCart, toggleWishlist } = useDemo();
  const wished = products.filter((product) =>
    state.wishlist.includes(product.slug),
  );
  return (
    <div className="armory-shell armory-page watch-page">
      <Heading title={copy.watchTitle} subtitle={copy.watchSub} />
      {!hydrated ? (
        <p role="status">{tr("Loading…")}</p>
      ) : wished.length ? (
        <div className="watch-grid">
          {wished.map((product) => {
            const info = findRecord(product.slug)?.[language];
            return (
              <article key={product.slug} className="plate">
                <Link href={`/product/${product.slug}`}>
                  <ProductFrame
                    src={product.image}
                    alt={info?.name ?? tr(product.name)}
                  />
                </Link>
                <div className="ware-body">
                  <div className="ware-bottom">
                    <h3>
                      <Link href={`/product/${product.slug}`}>
                        {info?.name ?? tr(product.name)}
                      </Link>
                    </h3>
                    <span className="ware-price">
                      {formatMoney(product.priceCents)}
                    </span>
                  </div>
                  <div className="action-row">
                    {product.variants.length > 1 ? (
                      <Link
                        className="forged forged-small"
                        href={`/product/${product.slug}`}
                      >
                        {tr("Choose a variant")}
                      </Link>
                    ) : (
                      <button
                        className="forged forged-small"
                        disabled={!product.variants[0]?.stock}
                        onClick={() => addToCart(product.variants[0]!.id)}
                      >
                        {copy.addToSatchel}
                      </button>
                    )}
                    <button
                      className="text-action"
                      onClick={() => toggleWishlist(product.slug)}
                    >
                      {copy.stopWatching}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-panel">
          <Mark name="feather" tone="bone" size={38} />
          <h2>{copy.emptyWatch}</h2>
          <Link className="forged" href="/catalog">
            {copy.seeTheWares}
          </Link>
        </div>
      )}
    </div>
  );
}
