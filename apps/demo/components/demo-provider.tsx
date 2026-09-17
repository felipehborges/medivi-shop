"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { addItem, cartTotal, initialState, parseState, STORAGE_KEY, updateItem, type DemoOrder, type DemoState } from "@/lib/store";
import { useDemoMessage } from "./locale-provider";

type DemoContextValue = {
  state: DemoState;
  hydrated: boolean;
  totalCents: number;
  cartCount: number;
  addToCart: (variantId: string, quantity?: number) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  toggleWishlist: (slug: string) => void;
  finishOrder: (email: string) => DemoOrder;
  toggleProduct: (slug: string) => void;
  reset: () => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const message = useDemoMessage();
  const [state, setState] = useState<DemoState>(initialState);
  const stateRef = useRef<DemoState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- hydration intentionally syncs from external browser storage */
  useEffect(() => {
    // Browser storage is intentionally loaded after hydration so the static
    // server snapshot stays deterministic.
    const stored = parseState(localStorage.getItem(STORAGE_KEY));
    stateRef.current = stored;
    setState(stored);
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const commit = useCallback((update: (current: DemoState) => DemoState) => {
    const next = update(stateRef.current);
    stateRef.current = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setState(next);
    return next;
  }, []);

  const addToCart = useCallback((variantId: string, quantity = 1) => {
    commit((current) => addItem(current, variantId, quantity));
    toast.success(message("addedToCart"));
  }, [commit, message]);
  const updateQuantity = useCallback((variantId: string, quantity: number) => commit((current) => updateItem(current, variantId, quantity)), [commit]);
  const toggleWishlist = useCallback((slug: string) => commit((current) => ({ ...current, wishlist: current.wishlist.includes(slug) ? current.wishlist.filter((item) => item !== slug) : [...current.wishlist, slug] })), [commit]);
  const finishOrder = useCallback((email: string) => {
    const current = stateRef.current;
    const created: DemoOrder = { id: `MDV-${Date.now().toString().slice(-8)}`, createdAt: new Date().toISOString(), email, items: current.cart, totalCents: cartTotal(current), status: "paid" };
    commit((latest) => ({ ...latest, cart: [], orders: [created, ...latest.orders] }));
    return created;
  }, [commit]);
  const toggleProduct = useCallback((slug: string) => commit((current) => ({ ...current, hiddenProducts: current.hiddenProducts.includes(slug) ? current.hiddenProducts.filter((item) => item !== slug) : [...current.hiddenProducts, slug] })), [commit]);
  const reset = useCallback(() => { localStorage.removeItem(STORAGE_KEY); stateRef.current = initialState; setState(initialState); toast.success(message("demoRestored")); }, [message]);

  const value = useMemo(() => ({ state, hydrated, totalCents: cartTotal(state), cartCount: state.cart.reduce((sum, item) => sum + item.quantity, 0), addToCart, updateQuantity, toggleWishlist, finishOrder, toggleProduct, reset }), [state, hydrated, addToCart, updateQuantity, toggleWishlist, finishOrder, toggleProduct, reset]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemo must be used inside DemoProvider");
  return context;
}
