import { products, shipping, type ProductId } from "./catalog";
import { calculateQuote, validateCustomer, type Customer, type OrderConfig, type OrderReceipt } from "./orders";

export interface CartItem { productId: ProductId; quantity: number; hooks: boolean; }
export interface CartQuote { productTotal: number; extras: number; subtotal: number; delivery: number; total: number; }
export interface CartPayload { items: CartItem[]; delivery: OrderConfig["delivery"]; pickupLocation: string; customer: Customer; }

export function parseCartItems(value: string | null): CartItem[] {
  try {
    const items: unknown = JSON.parse(value ?? "[]");
    if (!Array.isArray(items) || items.length > products.length) return [];
    const seen = new Set<string>();
    return items.map(item => {
      if (!item || !products.some(p => p.id === item.productId) || seen.has(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 || typeof item.hooks !== "boolean") throw new Error("Neispravna korpa");
      seen.add(item.productId);
      return { productId: item.productId, quantity: item.quantity, hooks: item.productId === "auto" && item.hooks };
    });
  } catch { return []; }
}

export function addCartItem(items: CartItem[], item: CartItem): CartItem[] {
  calculateQuote({ ...item, delivery: "pickup", pickupLocation: "" });
  const existing = items.find(row => row.productId === item.productId);
  if (existing && existing.quantity + item.quantity > 20) throw new Error("U korpi može biti najviše 20 komada istog proizvoda. Količinu možeš izmeniti u korpi.");
  const next = { ...item, hooks: item.productId === "auto" && item.hooks };
  return existing
    ? items.map(row => row.productId === item.productId ? { ...row, quantity: row.quantity + item.quantity, hooks: item.productId === "auto" && (row.hooks || next.hooks) } : row)
    : [...items, next];
}

export function calculateCartQuote(items: CartItem[], delivery: OrderConfig["delivery"]): CartQuote {
  const lines = items.map(item => calculateQuote({ ...item, delivery, pickupLocation: "" }));
  const productTotal = lines.reduce((sum, line) => sum + line.productTotal, 0);
  const extras = lines.reduce((sum, line) => sum + line.extras, 0);
  const subtotal = productTotal + extras;
  const deliveryCost = !items.length || delivery === "pickup" || subtotal >= shipping.freeFrom ? 0 : delivery === "post-office" ? shipping.postOffice : shipping.courier;
  return { productTotal, extras, subtotal, delivery: deliveryCost, total: subtotal + deliveryCost };
}

export async function submitDemoCartOrder(payload: CartPayload): Promise<OrderReceipt> {
  if (!payload.items.length || Object.keys(validateCustomer(payload.customer, payload.delivery)).length) throw new Error("Proveri podatke za porudžbinu.");
  if (payload.delivery === "pickup" && !["Novi Beograd", "Zemun", "Smederevo"].includes(payload.pickupLocation)) throw new Error("Izaberi lokaciju preuzimanja.");
  const quote = calculateCartQuote(payload.items, payload.delivery);
  await new Promise(resolve => setTimeout(resolve, 700));
  return { id: `MK-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, createdAt: new Date().toISOString(), mode: "demo", total: quote.total };
}
