import { z } from "zod";
import { type CartPayload } from "./cart";
import { validateCustomer } from "./orders";
import { OrderCapacityError, OrderConflictError, OrderRecordError, type OrderSubmissionService } from "./order-dispatcher.server";
const submissionSchema = z.object({
  requestId: z.string().uuid().transform(value => value.toLowerCase()),
  items: z.array(z.object({
    productId: z.enum(["auto", "moto", "hooks"]),
    quantity: z.number().int().min(1).max(20),
    hooks: z.boolean(),
  }).strict()).min(1).max(3),
  delivery: z.enum(["courier", "post-office"]),
  customer: z.object({
    name: z.string().trim().min(3).max(120),
    phone: z.string().trim().max(40),
    email: z.string().trim().email().max(254).regex(/^[^\r\n<>]+$/),
    city: z.string().trim().max(120),
    postalCode: z.string().trim().max(5),
    address: z.string().trim().max(250),
    note: z.string().trim().max(1000),
  }).strict(),
  // Legacy cart field is never used for postal delivery.
  pickupLocation: z.string().max(120).optional(),
}).strict();

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

// Best-effort per-process protection. Hosting proxy must overwrite client IP headers;
// configure edge rate limits as well for deployments with multiple processes.
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

export async function handleOrderRequest(request: Request, service: OrderSubmissionService | null): Promise<Response> {
  const origin = request.headers.get("Origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("Sec-Fetch-Site") === "cross-site") {
    return json({ error: "Zahtev nije dozvoljen." }, 403);
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Neispravan format zahteva." }, 415);
  }
  if (!service) return json({ error: "Poručivanje trenutno nije dostupno. Pokušaj kasnije ili nas kontaktiraj." }, 503);
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Real-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "local";
  if (!allowAttempt(ip)) return json({ error: "Previše pokušaja. Pokušaj ponovo kasnije." }, 429);

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
  try {
    const receipt = await service.submit(payload, data.requestId);
    if (!receipt) return json({ error: "Porudžbina nije potvrđena jer interni email nije poslat. Pokušaj ponovo ili nas kontaktiraj." }, 502);
    return json(receipt);
  } catch (error) {
    if (error instanceof OrderRecordError) return json({ error: "Porudžbina nije poslata jer evidencija nije sačuvana. Pokušaj ponovo ili nas kontaktiraj." }, 503);
    if (error instanceof OrderConflictError) return json({ error: "Podaci ovog pokušaja su izmenjeni. Ponovo otvori pregled porudžbine." }, 409);
    if (error instanceof OrderCapacityError) return json({ error: "Poručivanje je trenutno zauzeto. Pokušaj kasnije." }, 503);
    console.error("[order-email]", { requestId: data.requestId, code: "order_submission_failed" });
    return json({ error: "Potvrda nije uspela. Pokušaj ponovo ili nas kontaktiraj." }, 502);
  }
}
