"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDemo } from "./demo-provider";
import { useI18n } from "./locale-provider";
import { Heading, Mark } from "./armory";
import { CartEmpty } from "./cart-view";
import { carriageOptions, emptyDraft, readCheckout } from "@/lib/checkout";
export function PaymentView() {
  const { copy, tr, formatMoney } = useI18n();
  const { state, hydrated, totalCents, finishOrder } = useDemo();
  const router = useRouter();
  const [pay, setPay] = useState("coin");
  const [draft, setDraft] = useState(emptyDraft);
  const [declined, setDeclined] = useState(false);
  const [sealing, setSealing] = useState(false);
  const sealingRef = useRef(false);
  /* eslint-disable react-hooks/set-state-in-effect -- restore the session's shipping selection after hydration */
  useEffect(() => {
    setDraft(readCheckout());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const carriage =
    carriageOptions.find((option) => option.key === draft.carriage) ??
    carriageOptions[0];
  const methods = [
    { key: "coin", name: copy.payCoin, note: copy.payCoinNote, mark: "coins" },
    {
      key: "credit",
      name: copy.payCredit,
      note: copy.payCreditNote,
      mark: "scroll",
    },
    {
      key: "account",
      name: copy.payAccount,
      note: copy.payAccountNote,
      mark: "seal",
    },
  ];
  function approve() {
    if (sealingRef.current || !state.cart.length) return;
    if (!draft.bearer || !draft.road || !draft.town || !draft.kingdom) {
      router.push("/checkout");
      return;
    }
    sealingRef.current = true;
    setSealing(true);
    const order = finishOrder("", carriage.cents);
    sessionStorage.removeItem("medivi-demo-checkout");
    router.push(`/order/confirmation?id=${encodeURIComponent(order.id)}`);
  }
  return (
    <div className="armory-shell armory-page payment-page">
      <Link href="/checkout" className="back-link">
        ← {copy.backToLedger}
      </Link>
      <Heading title={copy.paymentTitle} subtitle={copy.paymentSub} />
      {!hydrated ? (
        <p role="status">{tr("Loading…")}</p>
      ) : !state.cart.length && !sealing ? (
        <CartEmpty />
      ) : (
        <>
          <fieldset className="choice-list">
            <legend className="sr-only">{copy.paymentTitle}</legend>
            {methods.map((method) => (
              <label key={method.key} className="choice">
                <Mark name={method.mark} tone="bone" size={28} />
                <span className="choice-text">
                  <strong>{method.name}</strong>
                  <small>{method.note}</small>
                </span>
                <input
                  type="radio"
                  name="payment"
                  value={method.key}
                  checked={pay === method.key}
                  onChange={() => setPay(method.key)}
                />
              </label>
            ))}
          </fieldset>
          <div className="payment-total">
            <div>
              <p className="caption">{copy.dueAtCounter}</p>
              <p className="large-price">
                {formatMoney(totalCents + carriage.cents)}
              </p>
              <p className="stock-line">{copy.sealNote}</p>
            </div>
            <button
              className="forged seal-button"
              disabled={sealing}
              onClick={approve}
            >
              <Mark name="seal" tone="bone" size={22} />
              {copy.pressTheSeal}
            </button>
          </div>
          <details className="admin-tools">
            <summary>{tr("Simulate decline")}</summary>
            <button className="text-action" onClick={() => setDeclined(true)}>
              {tr("Simulate decline")}
            </button>
            {declined && (
              <p role="alert">
                {tr("Payment simulation declined.")}{" "}
                {tr("Your cart was preserved. Choose approval to continue.")}
              </p>
            )}
          </details>
        </>
      )}
    </div>
  );
}
