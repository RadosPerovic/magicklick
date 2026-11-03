import { type CartPayload } from "./cart";
import { type OrderReceipt } from "./orders";

export async function submitCartOrder(payload: CartPayload, requestId: string): Promise<OrderReceipt> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, requestId }),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json();
  if (!result || typeof result !== "object") throw new Error("Potvrda porudžbine nije primljena. Pokušaj ponovo.");
  const data = result as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Porudžbina nije potvrđena. Pokušaj ponovo.");
  if (data.mode !== "live" || typeof data.id !== "string" || typeof data.total !== "number" || typeof data.createdAt !== "string") {
    throw new Error("Potvrda porudžbine nije primljena. Pokušaj ponovo.");
  }
  return { mode: "live", id: data.id, total: data.total, createdAt: data.createdAt };
}
