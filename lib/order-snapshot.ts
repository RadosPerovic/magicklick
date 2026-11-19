import { calculateCartQuote, type CartPayload } from "./cart";
import { autoHooksPromoPrice, products } from "./catalog";
import type { Customer, OrderReceipt } from "./orders";

export interface OrderEmailSnapshot extends OrderReceipt {
  customer: Customer;
  deliveryMethod: "courier" | "post-office";
  lines: { name: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  shipping: number;
}

// Both messages use one server-calculated snapshot. No order database.
export function snapshotOrder(payload: CartPayload, requestId: string): OrderEmailSnapshot {
  const quote = calculateCartQuote(payload.items, payload.delivery);
  return {
    id: `MK-${requestId.toUpperCase()}`, mode: "live",
    createdAt: new Date().toISOString(), customer: { ...payload.customer },
    deliveryMethod: payload.delivery as OrderEmailSnapshot["deliveryMethod"],
    lines: payload.items.flatMap(item => {
      const product = products.find(product => product.id === item.productId)!;
      return [
        { name: product.name, quantity: item.quantity, unitPrice: product.price, total: product.price * item.quantity },
        ...(item.productId === "auto" && item.hooks
          ? [{ name: "Dodatni MAGic KLICK Hooks (par)", quantity: 1, unitPrice: autoHooksPromoPrice, total: autoHooksPromoPrice }]
          : []),
      ];
    }),
    subtotal: quote.subtotal, shipping: quote.delivery, total: quote.total,
  };
}
