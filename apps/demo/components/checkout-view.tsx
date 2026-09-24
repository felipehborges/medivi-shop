"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { findRecord, findVariant } from "@/lib/catalog";
import { useDemo } from "./demo-provider";
import { useI18n } from "./locale-provider";
import { Heading, Mark } from "./armory";
import { CartEmpty, Totals } from "./cart-view";
import {
  carriageOptions,
  emptyDraft,
  readCheckout,
  type CheckoutDraft,
} from "@/lib/checkout";
export function CheckoutView() {
  const { copy, language, tr, formatMoney } = useI18n();
  const { state, hydrated } = useDemo();
  const router = useRouter();
  const [draft, setDraft] = useState(emptyDraft);
  // Browser-only form drafts are restored after the static server snapshot hydrates.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDraft(readCheckout());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const carriage =
    carriageOptions.find((option) => option.key === draft.carriage) ??
    carriageOptions[0];
  function update(key: keyof CheckoutDraft, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    sessionStorage.setItem("medivi-demo-checkout", JSON.stringify(next));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sessionStorage.setItem("medivi-demo-checkout", JSON.stringify(draft));
    router.push("/payment");
  }
  const fields = [
    {
      key: "bearer",
      label: copy.fBearer,
      placeholder: copy.fBearerP,
      wide: true,
    },
    { key: "road", label: copy.fRoad, placeholder: copy.fRoadP, wide: true },
    { key: "town", label: copy.fTown, placeholder: copy.fTownP },
    { key: "kingdom", label: copy.fKingdom, placeholder: copy.fKingdomP },
    { key: "mark", label: copy.fMark, placeholder: copy.fMarkP, wide: true },
  ] as const;
  return (
    <div className="armory-shell armory-page checkout-page">
      <Link href="/cart" className="back-link">
        ← {copy.backToManifest}
      </Link>
      <Heading title={copy.checkoutTitle} subtitle={copy.checkoutSub} />
      {!hydrated ? (
        <p role="status">{tr("Loading…")}</p>
      ) : !state.cart.length ? (
        <CartEmpty />
      ) : (
        <div className="checkout-grid">
          <form onSubmit={submit} className="plate checkout-form">
            <fieldset className="form-section">
              <legend className="eyebrow">
                <Mark name="feather" />
                {copy.handOfBearer}
              </legend>
              <div className="form-fields">
                {fields.map((field) => (
                  <div
                    key={field.key}
                    className={`field ${"wide" in field ? "field-wide" : ""}`}
                  >
                    <label htmlFor={field.key}>{field.label}</label>
                    <input
                      className="sunken"
                      id={field.key}
                      name={field.key}
                      required={field.key !== "mark"}
                      placeholder={field.placeholder}
                      value={draft[field.key]}
                      onChange={(event) =>
                        update(field.key, event.target.value)
                      }
                    />
                  </div>
                ))}
              </div>
            </fieldset>
            <fieldset className="form-section">
              <legend className="eyebrow">
                <Mark name="shield" />
                {copy.mannerOfCarriage}
              </legend>
              <div className="choice-list">
                {carriageOptions.map((option) => (
                  <label className="choice" key={option.key}>
                    <input
                      type="radio"
                      name="carriage"
                      value={option.key}
                      checked={carriage.key === option.key}
                      onChange={() => update("carriage", option.key)}
                    />
                    <Mark name={option.mark} tone="bone" size={22} />
                    <span className="choice-text">
                      <strong>{copy[option.name]}</strong>
                      <small>{copy[option.eta]}</small>
                    </span>
                    <span className="choice-price">
                      {option.cents
                        ? formatMoney(option.cents)
                        : copy.byTheHouse}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="forged w-full">
              {copy.toTheSeal}
            </button>
          </form>
          <aside className="parchment checkout-summary">
            <h2>
              <Mark name="scroll" tone="ink" size={18} />
              {copy.manifestHead}
            </h2>
            {state.cart.map((item) => {
              const match = findVariant(item.variantId);
              if (!match) return null;
              return (
                <div className="summary-line" key={item.variantId}>
                  <span>
                    {findRecord(match.product.slug)?.[language].name ??
                      tr(match.product.name)}{" "}
                    ×{item.quantity}
                  </span>
                  <span>
                    {formatMoney(
                      (match.variant.priceCents ?? match.product.priceCents) *
                        item.quantity,
                    )}
                  </span>
                </div>
              );
            })}
            <Totals carriage={carriage.cents} />
          </aside>
        </div>
      )}
    </div>
  );
}
