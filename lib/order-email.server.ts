import { z } from "zod";
import { calculateCartQuote, type CartPayload } from "./cart";
import { products, formatPrice, autoHooksPromoPrice } from "./catalog";
import { validateCustomer, type OrderReceipt } from "./orders";

export interface OrderEmailConfig {
  ORDERS_ENABLED?: string;
  RESEND_API_KEY?: string;
  ORDER_EMAIL_FROM?: string;
}

// Recipient and provider credentials are used exclusively by the server.
const recipient = "magicklick.rs@gmail.com";
const submissionSchema = z.object({
  requestId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.enum(["auto", "moto", "hooks"]),
    quantity: z.number().int().min(1).max(20),
    hooks: z.boolean(),
  }).strict()).min(1).max(3),
  delivery: z.enum(["courier", "post-office"]),
  customer: z.object({
    name: z.string().trim().min(3).max(120),
    phone: z.string().trim().max(40),
    email: z.string().trim().max(254),
    city: z.string().trim().max(120),
    postalCode: z.string().trim().max(5),
    address: z.string().trim().max(250),
    note: z.string().trim().max(1000),
  }).strict(),
  // Legacy cart field is never used for postal delivery.
  pickupLocation: z.string().max(120).optional(),
}).strict();

export function ordersEnabled(config: OrderEmailConfig): boolean {
  return config.ORDERS_ENABLED === "true" && !!config.RESEND_API_KEY?.trim() && !!config.ORDER_EMAIL_FROM?.trim();
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

// Best-effort per-worker protection. Provider limits still apply across workers.
const attempts = new Map<string, { count: number; until: number }>();
function allowAttempt(ip: string): boolean {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const existing = attempts.get(ip);
  if (existing) return ++existing.count <= 10;
  if (attempts.size >= 5000) return false;
  attempts.set(ip, { count: 1, until: now + 10 * 60_000 });
  return true;
}

async function readBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16_384) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(body);
}

function emailText(payload: CartPayload, orderId: string): string {
  const quote = calculateCartQuote(payload.items, payload.delivery);
  const lines = payload.items.flatMap(item => {
    const product = products.find(product => product.id === item.productId)!;
    return [
      `${product.name} × ${item.quantity} — ${formatPrice(product.price * item.quantity)}`,
      ...(item.productId === "auto" && item.hooks ? [`Dodatni MAGic KLICK Hooks, 1 par — ${formatPrice(autoHooksPromoPrice)}`] : []),
    ];
  });
  const customer = payload.customer;
  return [
    "NOVA MAGic KLICK PORUDŽBINA", orderId, "", "PROIZVODI", ...lines, "",
    `Proizvodi ukupno: ${formatPrice(quote.subtotal)}`,
    `Poštarina: ${quote.delivery === 0 ? "Besplatno" : formatPrice(quote.delivery)}`,
    `UKUPNO: ${formatPrice(quote.total)}`, "", "KUPAC",
    `Ime i prezime: ${customer.name}`, `Telefon: ${customer.phone}`,
    `Email: ${customer.email || "Nije naveden"}`, "", "ISPORUKA",
    payload.delivery === "post-office" ? "Post Express — preuzimanje u pošti" : "Post Express — na adresu",
    ...(payload.delivery === "courier" ? [`Mesto: ${customer.city}`, `Ulica i broj: ${customer.address}`] : []),
    `Poštanski broj: ${customer.postalCode}`, "", "NAPOMENA", customer.note || "Nema napomene.",
  ].join("\n");
}

export async function handleOrderRequest(request: Request, config: OrderEmailConfig, send: typeof fetch = fetch): Promise<Response> {
  const origin = request.headers.get("Origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("Sec-Fetch-Site") === "cross-site") {
    return json({ error: "Zahtev nije dozvoljen." }, 403);
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Neispravan format zahteva." }, 415);
  }
  if (!ordersEnabled(config)) return json({ error: "Poručivanje trenutno nije dostupno. Pokušaj kasnije ili nas kontaktiraj." }, 503);
  if (!allowAttempt(request.headers.get("CF-Connecting-IP") || "local")) return json({ error: "Previše pokušaja. Pokušaj ponovo kasnije." }, 429);

  let raw: unknown;
  try { raw = JSON.parse(await readBody(request)); }
  catch (error) { return json({ error: "Neispravni podaci porudžbine." }, error instanceof Error && error.message === "body_too_large" ? 413 : 400); }
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "Proveri podatke porudžbine." }, 400);
  const data = parsed.data;
  if (new Set(data.items.map(item => item.productId)).size !== data.items.length || data.items.some(item => item.hooks && item.productId !== "auto")) {
    return json({ error: "Proveri proizvode u korpi." }, 400);
  }
  if (Object.keys(validateCustomer(data.customer, data.delivery)).length) return json({ error: "Proveri podatke za isporuku." }, 400);

  const payload: CartPayload = { ...data, pickupLocation: "" };
  const orderId = `MK-${data.requestId.toUpperCase()}`;
  const quote = calculateCartQuote(payload.items, payload.delivery);
  try {
    const result = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `order/${data.requestId}`,
      },
      body: JSON.stringify({
        from: config.ORDER_EMAIL_FROM!.trim(),
        to: [recipient],
        ...(data.customer.email ? { reply_to: data.customer.email } : {}),
        subject: `Nova porudžbina ${orderId} — MAGic KLICK`,
        text: emailText(payload, orderId),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!result.ok) return json({ error: "Porudžbina nije potvrđena. Pokušaj ponovo ili nas kontaktiraj." }, 502);
    const accepted: unknown = await result.json();
    if (!accepted || typeof accepted !== "object" || !("id" in accepted) || typeof accepted.id !== "string" || !accepted.id) throw new Error("missing_email_id");
    const receipt: OrderReceipt = { id: orderId, createdAt: new Date().toISOString(), mode: "live", total: quote.total };
    return json(receipt);
  } catch {
    return json({ error: "Potvrda nije uspela. Pokušaj ponovo ili nas kontaktiraj." }, 502);
  }
}
