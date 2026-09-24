"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDemo } from "./demo-provider";
import { useI18n } from "./locale-provider";
import { Mark } from "./armory";
export function ConfirmationView() {
  const { copy, tr } = useI18n();
  const { state, hydrated } = useDemo();
  const id = useSearchParams().get("id");
  const order = state.orders.find((item) => item.id === id);
  if (!hydrated)
    return (
      <div className="armory-shell armory-page" role="status">
        {tr("Loading…")}
      </div>
    );
  return (
    <div className="armory-shell sealed-page">
      <section className="parchment sealed-sheet">
        <Mark name="seal" tone="ink" size={54} />
        <h1>{order ? copy.sealedTitle : tr("Demo order not found")}</h1>
        <p>
          {order
            ? copy.sealedSub
            : tr("Browser-local orders disappear when demo data is reset.")}
        </p>
        {order && (
          <>
            <div className="entry-number">
              <span className="caption">{copy.entryNo}</span>
              <strong>{order.id}</strong>
            </div>
            <p>
              <em>{copy.sealedNote}</em>
            </p>
          </>
        )}
        <Link className="forged" href="/catalog">
          {copy.backToFloor}
        </Link>
      </section>
    </div>
  );
}
