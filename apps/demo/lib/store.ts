import { findVariant, products, type Product } from "./catalog";

export const STORAGE_KEY = "medivi-demo-state-v1";
export type CartItem = { variantId: string; quantity: number };
export type DemoOrder = { id: string; createdAt: string; email: string; items: CartItem[]; totalCents: number; status: "paid" };
export type DemoState = { version: 1; cart: CartItem[]; wishlist: string[]; orders: DemoOrder[]; hiddenProducts: string[] };
export const initialState: DemoState = { version: 1, cart: [], wishlist: [], orders: [], hiddenProducts: [] };

export function parseState(value: string | null): DemoState {
  if (!value) return initialState;
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== "object" || (data as { version?: unknown }).version !== 1) return initialState;
    const candidate = data as Partial<DemoState>;
    return {
      version: 1,
      cart: Array.isArray(candidate.cart) ? candidate.cart.filter((item): item is CartItem => !!item && typeof item.variantId === "string" && Number.isInteger(item.quantity) && item.quantity > 0 && !!findVariant(item.variantId)) : [],
      wishlist: Array.isArray(candidate.wishlist) ? candidate.wishlist.filter((slug): slug is string => typeof slug === "string" && products.some((product) => product.slug === slug)) : [],
      orders: Array.isArray(candidate.orders) ? candidate.orders.filter((order): order is DemoOrder => !!order && typeof order.id === "string" && Array.isArray(order.items)) : [],
      hiddenProducts: Array.isArray(candidate.hiddenProducts) ? candidate.hiddenProducts.filter((slug): slug is string => typeof slug === "string") : [],
    };
  } catch { return initialState; }
}

export function addItem(state: DemoState, variantId: string, quantity = 1): DemoState {
  const match = findVariant(variantId);
  if (!match) return state;
  const existing = state.cart.find((item) => item.variantId === variantId);
  const nextQuantity = Math.min(match.variant.stock, (existing?.quantity ?? 0) + quantity);
  return { ...state, cart: existing ? state.cart.map((item) => item.variantId === variantId ? { ...item, quantity: nextQuantity } : item) : [...state.cart, { variantId, quantity: nextQuantity }] };
}

export function updateItem(state: DemoState, variantId: string, quantity: number): DemoState {
  const match = findVariant(variantId);
  if (!match || quantity <= 0) return { ...state, cart: state.cart.filter((item) => item.variantId !== variantId) };
  return { ...state, cart: state.cart.map((item) => item.variantId === variantId ? { ...item, quantity: Math.min(quantity, match.variant.stock) } : item) };
}

export function cartTotal(state: DemoState) {
  return state.cart.reduce((total, item) => { const match = findVariant(item.variantId); return total + (match ? (match.variant.priceCents ?? match.product.priceCents) * item.quantity : 0); }, 0);
}

export function visibleProducts(state: DemoState): Product[] { return products.filter((product) => !state.hiddenProducts.includes(product.slug)); }
