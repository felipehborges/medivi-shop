export const SHIPPING_METHODS = [
  { id: "standard", label: "Standard Shipping (5–7 days)", cents: 500 },
  { id: "express", label: "Express Shipping (2–3 days)", cents: 1500 },
] as const;

export type ShippingMethodId = (typeof SHIPPING_METHODS)[number]["id"];

export const SHIPPING_METHOD_IDS = SHIPPING_METHODS.map((m) => m.id) as [ShippingMethodId, ...ShippingMethodId[]];

export function getShippingMethod(id: ShippingMethodId) {
  const method = SHIPPING_METHODS.find((m) => m.id === id);
  if (!method) throw new Error(`Unknown shipping method: ${id}`);
  return method;
}
