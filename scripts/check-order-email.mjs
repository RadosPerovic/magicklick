import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as zod from "zod";

const cache = new Map();
function load(relative) {
  const url = new URL(relative, import.meta.url);
  if (cache.has(url.href)) return cache.get(url.href);
  const exports = {};
  cache.set(url.href, exports);
  const source = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports, crypto: globalThis.crypto, setTimeout, Request, Response, TextDecoder, AbortSignal, URL,
    fetch() { throw new Error("Tests must never send email."); },
    require(name) {
      if (name === "zod") return zod;
      if (name.startsWith("./")) return load(new URL(`${name}.ts`, url).href);
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}
const { ordersEnabled, handleOrderRequest } = load("../lib/order-email.server.ts");
const config = { ORDERS_ENABLED: "true", RESEND_API_KEY: "fake-test-key", ORDER_EMAIL_FROM: "MAGic KLICK <orders@example.com>" };
const payload = {
  requestId: "12345678-1234-4123-8123-123456789abc",
  items: [{ productId: "auto", quantity: 2, hooks: true }, { productId: "moto", quantity: 1, hooks: false }],
  delivery: "courier", pickupLocation: "",
  customer: { name: "Test Kupac", phone: "0641234567", email: "test@example.com", city: "Beograd", postalCode: "11000", address: "Test ulica 12", note: "Test napomena" },
};
let ip = 0;
function request(body = payload, headers = {}) {
  return new Request("https://shop.example/api/orders", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://shop.example", "CF-Connecting-IP": `test-${++ip}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const sent = [];
async function accept(url, options) {
  sent.push({ url, headers: options.headers, body: JSON.parse(options.body) });
  return Response.json({ id: "fake-provider-message-id" });
}
assert.equal(ordersEnabled({}), false);
assert.equal(ordersEnabled({ ...config, ORDERS_ENABLED: "false" }), false);
assert.equal(ordersEnabled({ ...config, RESEND_API_KEY: "" }), false);
assert.equal(ordersEnabled(config), true);
assert.equal((await handleOrderRequest(request(), {}, accept)).status, 503);
assert.equal(sent.length, 0);
const response = await handleOrderRequest(request(), config, accept);
assert.equal(response.status, 200);
const receipt = await response.json();
assert.equal(receipt.mode, "live");
assert.equal(receipt.total, 4400);
assert.equal(receipt.id, `MK-${payload.requestId.toUpperCase()}`);
assert.deepEqual(sent[0].body.to, ["magicklick.rs@gmail.com"]);
assert.equal(sent[0].url, "https://api.resend.com/emails");
assert.equal(sent[0].body.reply_to, "test@example.com");
assert(sent[0].body.text.includes("MAGic KLICK Auto × 2"));
assert(sent[0].body.text.includes("Test napomena"));
assert(sent[0].body.text.includes("Test ulica 12"));
assert(!JSON.stringify(receipt).includes(config.RESEND_API_KEY));
assert(!JSON.stringify(receipt).includes("magicklick.rs@gmail.com"));
await handleOrderRequest(request(), config, accept);
assert.equal(sent[0].headers["Idempotency-Key"], sent[1].headers["Idempotency-Key"]);
assert.deepEqual(sent[0].body, sent[1].body); // Retries produce identical provider payloads.

const postalPayload = { ...payload, delivery: "post-office", customer: { ...payload.customer, city: "", address: "", email: "" } };
const postalResponse = await handleOrderRequest(request(postalPayload), config, accept);
assert.equal(postalResponse.status, 200);
assert.equal((await postalResponse.json()).total, 4280);
assert(sent.at(-1).body.text.includes(`Poštarina: ${new Intl.NumberFormat("sr-RS").format(480)} RSD`));
assert(sent.at(-1).body.text.includes("preuzimanje u pošti"));
assert(!("reply_to" in sent.at(-1).body));
const invalidBodies = [
  {}, { ...payload, items: [] }, { ...payload, items: [payload.items[0], payload.items[0]] },
  { ...payload, items: [{ productId: "auto", quantity: 0, hooks: false }] },
  { ...payload, items: [{ productId: "moto", quantity: 1, hooks: true }] },
  { ...payload, delivery: "pickup" }, { ...payload, requestId: "invalid" },
  { ...payload, total: 1 }, { ...payload, to: "other@example.com" },
  { ...postalPayload, customer: { ...postalPayload.customer, postalCode: "" } },
  { ...payload, customer: { ...payload.customer, address: "" } },
  { ...payload, customer: { ...payload.customer, email: "bad\r\nBcc: other@example.com" } },
];
const beforeInvalid = sent.length;
for (const body of invalidBodies) assert.equal((await handleOrderRequest(request(body), config, accept)).status, 400);
assert.equal(sent.length, beforeInvalid);
assert.equal((await handleOrderRequest(request("{invalid"), config, accept)).status, 400);
assert.equal((await handleOrderRequest(request("x".repeat(17_000)), config, accept)).status, 413);
assert.equal((await handleOrderRequest(request(payload, { Origin: "https://other.example" }), config, accept)).status, 403);
assert.equal((await handleOrderRequest(request(payload, { "Content-Type": "text/plain" }), config, accept)).status, 415);
assert.equal((await handleOrderRequest(request(), config, async () => Response.json({ error: "private-provider-error" }, { status: 403 }))).status, 502);
assert.equal((await handleOrderRequest(request(), config, async () => Response.json({}))).status, 502);
const failure = await handleOrderRequest(request(), config, async () => { throw new Error(config.RESEND_API_KEY); });
assert.equal(failure.status, 502);
assert(!(await failure.text()).includes(config.RESEND_API_KEY));
for (let i = 0; i < 10; i++) assert.equal((await handleOrderRequest(request(payload, { "CF-Connecting-IP": "rate-test" }), config, accept)).status, 200);
assert.equal((await handleOrderRequest(request(payload, { "CF-Connecting-IP": "rate-test" }), config, accept)).status, 429);
console.log("PASS: server email configuration, validation, totals, recipient, retries, errors, request limits and both delivery methods. No email was sent.");
