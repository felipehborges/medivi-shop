export const carriageOptions = [
  {
    key: "rider",
    name: "carriageRider",
    eta: "carriageRiderEta",
    mark: "shield",
    cents: 900,
  },
  {
    key: "caravan",
    name: "carriageCaravan",
    eta: "carriageCaravanEta",
    mark: "knot",
    cents: 0,
  },
  {
    key: "raven",
    name: "carriageRaven",
    eta: "carriageRavenEta",
    mark: "feather",
    cents: 2400,
  },
] as const;
export type CheckoutDraft = {
  bearer: string;
  road: string;
  town: string;
  kingdom: string;
  mark: string;
  carriage: string;
};
export const emptyDraft: CheckoutDraft = {
  bearer: "",
  road: "",
  town: "",
  kingdom: "",
  mark: "",
  carriage: "rider",
};
export function readCheckout(): CheckoutDraft {
  try {
    const raw: unknown = JSON.parse(
      sessionStorage.getItem("medivi-demo-checkout") ?? "null",
    );
    if (!raw || typeof raw !== "object") return emptyDraft;
    return Object.fromEntries(
      Object.entries(emptyDraft).map(([key, value]) => [
        key,
        typeof (raw as Record<string, unknown>)[key] === "string"
          ? (raw as Record<string, string>)[key]
          : value,
      ]),
    ) as CheckoutDraft;
  } catch {
    return emptyDraft;
  }
}
