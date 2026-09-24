"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { carriageOptions, readCheckout } from "@/lib/checkout";
import { findRecord, findVariant } from "@/lib/catalog";
import { useDemo } from "./demo-provider";
import { useI18n } from "./locale-provider";
import { Heading, Mark, ProductFrame, Rivets } from "./armory";
export function CartEmpty() {
  const { copy } = useI18n();
  return (
    <div className="empty-panel">
      <Mark name="scroll" tone="bone" size={40} />
      <h2>{copy.emptyCart}</h2>
      <Link className="forged" href="/catalog">
        {copy.seeTheWares}
      </Link>
    </div>
  );
}
export function Totals({ carriage = 0 }: { carriage?: number }) {
  const { copy, formatMoney } = useI18n();
  const { totalCents } = useDemo();
  return (
    <div className="totals">
      <div>
        <span>{copy.sumOfWares}</span>
        <span>{formatMoney(totalCents)}</span>
      </div>
      <div>
        <span>{copy.carriage}</span>
        <span>{carriage ? formatMoney(carriage) : copy.byTheHouse}</span>
      </div>
      <div className="due">
        <span className="caption">{copy.dueAtCounter}</span>
        <strong>{formatMoney(totalCents + carriage)}</strong>
      </div>
    </div>
  );
}
export function CartView() {
  const { copy, language, tr, formatMoney } = useI18n();
  const { state, hydrated, updateQuantity } = useDemo();
  const [carriage, setCarriage] = useState(900);
  /* eslint-disable react-hooks/set-state-in-effect -- restore the session's shipping selection after hydration */
  useEffect(() => {
    setCarriage(
      (
        carriageOptions.find(
          (option) => option.key === readCheckout().carriage,
        ) ?? carriageOptions[0]
      ).cents,
    );
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  return (
    <div className="armory-shell cart-page">
      <Heading title={copy.cartTitle} subtitle={copy.cartSub} />
      {!hydrated ? (
        <p role="status">{tr("Loading…")}</p>
      ) : !state.cart.length ? (
        <CartEmpty />
      ) : (
        <>
          <section className="parchment manifest">
            <Rivets />
            <div className="manifest-head">
              <h2>
                <Mark name="scroll" tone="ink" size={26} />
                {copy.manifestHead}
              </h2>
              <span className="caption">
                {copy.entryNo} · MMXCI–{1147 + state.orders.length}
              </span>
            </div>
            <div className="manifest-row manifest-columns" aria-hidden="true">
              <span>{copy.colWare}</span>
              <span>{copy.colCount}</span>
              <span>{copy.colEach}</span>
              <span>{copy.colSum}</span>
            </div>
            {state.cart.map((item) => {
              const match = findVariant(item.variantId);
              if (!match) return null;
              const { product, variant } = match;
              const info = findRecord(product.slug)?.[language];
              const price = variant.priceCents ?? product.priceCents;
              return (
                <article className="manifest-row" key={item.variantId}>
                  <Link
                    href={`/product/${product.slug}`}
                    aria-label={info?.name ?? tr(product.name)}
                  >
                    <ProductFrame src={product.image} alt="" variant="small" />
                  </Link>
                  <div>
                    <Link
                      className="manifest-name"
                      href={`/product/${product.slug}`}
                    >
                      {info?.name ?? tr(product.name)}
                    </Link>
                    <p className="manifest-meta">
                      {info?.material ?? tr(product.material)}
                      {info && ` · ${info.origin}`}
                      {product.variants.length > 1 && ` · ${tr(variant.name)}`}
                    </p>
                    <button
                      className="strike-out"
                      onClick={() => updateQuantity(item.variantId, 0)}
                    >
                      {copy.strikeOut}
                    </button>
                  </div>
                  <div className="line-quantity">
                    <span className="mobile-label">{copy.colCount}</span>
                    <div
                      className="stepper"
                      role="group"
                      aria-label={`${copy.colCount}: ${info?.name ?? product.name}`}
                    >
                      <button
                        aria-label={tr("Decrease quantity")}
                        disabled={item.quantity <= 1}
                        onClick={() =>
                          updateQuantity(item.variantId, item.quantity - 1)
                        }
                      >
                        −
                      </button>
                      <output>{item.quantity}</output>
                      <button
                        aria-label={tr("Increase quantity")}
                        disabled={item.quantity >= variant.stock}
                        onClick={() =>
                          updateQuantity(item.variantId, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="line-each">
                    <span className="mobile-label">{copy.colEach}</span>
                    {formatMoney(price)}
                  </p>
                  <p className="line-sum">
                    <span className="mobile-label">{copy.colSum}</span>
                    {formatMoney(price * item.quantity)}
                  </p>
                </article>
              );
            })}
            <Totals carriage={carriage} />
            <p className="manifest-note">{copy.manifestNote}</p>
          </section>
          <div className="action-row">
            <Link href="/checkout" className="forged">
              {copy.toTheLedger}
            </Link>
            <Link href="/catalog" className="text-action">
              ← {copy.keepLooking}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
