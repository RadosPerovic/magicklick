"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { addCartItem, parseCartItems, type CartItem } from "@/lib/cart";
import type { ProductId } from "@/lib/catalog";

const storageKey = "magic-klick-cart-v1";
interface CartContextValue {
  items: CartItem[];
  ready: boolean;
  addItem: (item: CartItem) => void;
  updateItem: (productId: ProductId, changes: Partial<Pick<CartItem, "quantity" | "hooks">>) => void;
  removeItem: (productId: ProductId) => void;
  clearCart: () => void;
}
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const current = useRef<CartItem[]>([]);
  useEffect(() => {
    let saved: CartItem[] = [];
    try { saved = parseCartItems(sessionStorage.getItem(storageKey)); } catch { /* Storage can be disabled. */ }
    current.current = saved;
    setItems(saved);
    setReady(true);
  }, []);
  function save(next: CartItem[]) {
    current.current = next;
    setItems(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* The cart still works in memory. */ }
  }
  function updateItem(productId: ProductId, changes: Partial<Pick<CartItem, "quantity" | "hooks">>) {
    if (changes.quantity !== undefined && (!Number.isInteger(changes.quantity) || changes.quantity < 1 || changes.quantity > 20)) return;
    save(current.current.map(item => item.productId === productId ? { ...item, ...changes, hooks: productId === "auto" && (changes.hooks ?? item.hooks) } : item));
  }
  return <CartContext.Provider value={{ items, ready, addItem: item => save(addCartItem(current.current, item)), updateItem, removeItem: productId => save(current.current.filter(item => item.productId !== productId)), clearCart: () => save([]) }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("Korpa nije dostupna.");
  return cart;
}
