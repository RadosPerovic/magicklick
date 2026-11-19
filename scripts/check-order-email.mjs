import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import * as fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import nodemailer from "nodemailer";

const logs = [];
let transportOptions;
let transportResult = { accepted: ["test@example.com"], rejected: [] };
let closeCount = 0;
let transportError;
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
    exports, crypto: globalThis.crypto, setTimeout, clearTimeout, Request, Response, TextDecoder, AbortSignal, URL, process,
    console: { error: (...args) => logs.push(args) }, __MAGIC_KLICK_NODE__: false,
    fetch() { throw new Error("Tests must never send email."); },
    require(name) {
      if (name === "zod") return zod;
      if (name === "node:fs") return fs;
      if (name === "node:path") return { default: path };
      if (name === "nodemailer") return { default: { createTransport(options) {
        transportOptions = options;
        return {
          async sendMail() { if (transportError) throw transportError; return transportResult; },
          close() { closeCount++; },
        };
      } } };
      if (name.startsWith("./")) return load(new URL(`${name}.ts`, url).href);
      if (name.startsWith("@/")) return load(`../${name.slice(2)}.ts`);
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}
const { handleOrderRequest } = load("../lib/order-email.server.ts");
const { createOrderSubmissionService, safeEmailError } = load("../lib/order-dispatcher.server.ts");
const { smtpOptions, smtpSender } = load("../lib/smtp-transport.server.ts");
const { loadServerEmailSettings, smtpConfigSchema } = load("../lib/smtp-config.server.ts");
const config = { ...JSON.parse(readFileSync(new URL("../config/order-email.example.json", import.meta.url), "utf8")), enabled: true, password: "fake-test-password-never-log" };
const payload = {
  requestId: "12345678-1234-4123-8123-123456789abc",
  items: [{ productId: "auto", quantity: 2, hooks: true }, { productId: "moto", quantity: 1, hooks: false }],
  delivery: "courier", pickupLocation: "",
  customer: { name: "Test Kupac", phone: "0641234567", email: "test@example.com", city: "Beograd", postalCode: "11000", address: "Test ulica 12", note: 'Test <img src=x onerror="alert(1)"> & napomena\nDrugi red' },
};
let ip = 0;
function request(body = payload, headers = {}) {
  return new Request("https://shop.example/api/orders", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://shop.example", "CF-Connecting-IP": `test-${++ip}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const sent = [];
const records = [];
const service = createOrderSubmissionService(config, async message => {
  assert(records.some(order => message.subject.endsWith(order.id)));
  sent.push(message);
}, async order => { records.push(order); return order; });
assert.equal((await handleOrderRequest(request(), null)).status, 503);
assert.equal(sent.length, 0);
const response = await handleOrderRequest(request(), service);
assert.equal(response.status, 200);
const receipt = await response.json();
assert.equal(receipt.mode, "live");
assert.equal(receipt.total, 4400);
assert.equal(receipt.id, `MK-${payload.requestId.toUpperCase()}`);
assert.equal(sent.length, 2);
const internal = sent.find(message => message.to === config.ordersEmail);
const customer = sent.find(message => message.to === payload.customer.email);
assert.equal(internal.subject, `Nova porudžbina #${receipt.id}`);
assert.equal(customer.subject, `Potvrda porudžbine #${receipt.id}`);
for (const message of sent) {
  assert.equal(message.from.address, config.fromEmail);
  assert.equal(message.from.name, config.fromName);
  assert.equal(message.replyTo, config.fromEmail);
  assert.equal(message.cc, undefined);
  assert.equal(message.bcc, undefined);
  assert(message.text.includes("MAGic KLICK Auto × 2"));
  assert(message.text.includes("Cena po komadu:"));
  assert(message.text.includes("Test ulica 12"));
  assert(message.text.includes("Drugi red"));
  assert(message.html.includes("&lt;img"));
  assert(!message.html.includes("<img"));
  assert(message.html.includes("&amp; napomena<br>Drugi red"));
  assert(message.text.includes(new Intl.NumberFormat("sr-RS").format(4400)));
  assert(message.text.includes("Datum:"));
  assert.equal(message.date.toISOString(), receipt.createdAt);
}
assert(customer.text.includes("Hvala na porudžbini"));
assert.equal(customer.text.split("\n")[1], "Hvala na porudžbini! U nastavku je pregled Vaše porudžbine.");
assert(customer.html.includes("Hvala na porudžbini! U nastavku je pregled Vaše porudžbine."));
assert(!customer.html.includes(`Hvala na porudžbini, ${payload.customer.name}`));
assert(internal.text.includes(payload.customer.phone));
assert(!JSON.stringify(receipt).includes(config.password));
assert(!JSON.stringify(receipt).includes(config.ordersEmail));
assert.equal((await handleOrderRequest(request(), service)).status, 200);
assert.equal((await handleOrderRequest(request({ ...payload, requestId: payload.requestId.toUpperCase() }), service)).status, 200);
assert.equal(sent.length, 2); // Repeated POSTs cannot resend accepted messages in this process.
assert.equal(records.length, 1);
const conflict = { ...payload, customer: { ...payload.customer, name: "Drugi Kupac" } };
assert.equal((await handleOrderRequest(request(conflict), service)).status, 409);
assert.equal(sent.length, 2);

// Real MIME generation through Nodemailer's buffer-only stream transport, no socket.
const mime = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(customer);
const raw = mime.message.toString();
assert.match(raw, /Content-Type: multipart\/alternative/);
assert.match(raw, /Content-Type: text\/plain; charset=utf-8/);
assert.match(raw, /Content-Type: text\/html; charset=utf-8/);
assert.match(raw, /Reply-To: info@magic-klick.rs/);
assert.match(raw, /To: test@example.com/);
assert(!/^Bcc:|^Cc:/m.test(raw));
assert.equal(mime.envelope.to.length, 1);

const postalPayload = { ...payload, requestId: crypto.randomUUID(), delivery: "post-office", customer: { ...payload.customer, city: "", address: "" } };
const postalResponse = await handleOrderRequest(request(postalPayload), service);
assert.equal(postalResponse.status, 200);
assert.equal((await postalResponse.json()).total, 4280);
assert(sent.at(-1).text.includes(`Dostava: ${new Intl.NumberFormat("sr-RS").format(480)} RSD`));
assert(sent.at(-1).text.includes("preuzimanje u pošti"));
assert(!sent.at(-1).text.includes("Ulica i broj:"));
const freeShipping = { ...payload, requestId: crypto.randomUUID(), items: [{ productId: "auto", quantity: 6, hooks: false }] };
assert.equal((await handleOrderRequest(request(freeShipping), service)).status, 200);
assert(sent.at(-1).text.includes("Dostava: Besplatno"));

const invalidBodies = [
  {}, { ...payload, items: [] }, { ...payload, items: [payload.items[0], payload.items[0]] },
  { ...payload, items: [{ productId: "auto", quantity: 0, hooks: false }] },
  { ...payload, items: [{ productId: "moto", quantity: 1, hooks: true }] },
  { ...payload, delivery: "pickup" }, { ...payload, requestId: "invalid" },
  { ...payload, total: 1 }, { ...payload, to: "other@example.com" },
  { ...postalPayload, customer: { ...postalPayload.customer, postalCode: "" } },
  { ...payload, customer: { ...payload.customer, address: "" } },
  { ...payload, customer: { ...payload.customer, email: "test@example.com\r\nBcc: other@example.com" } },
  ...["courier", "post-office"].flatMap(delivery => ["", "   ", "pogresna-adresa"].map(email => ({ ...payload, delivery, customer: { ...payload.customer, email } }))),
];
const beforeInvalid = sent.length;
for (const body of invalidBodies) assert.equal((await handleOrderRequest(request(body), service)).status, 400);
assert.equal(sent.length, beforeInvalid);
assert.equal((await handleOrderRequest(request("{invalid"), service)).status, 400);
assert.equal((await handleOrderRequest(request("x".repeat(17_000)), service)).status, 413);
assert.equal((await handleOrderRequest(request(payload, { Origin: "https://other.example" }), service)).status, 403);
assert.equal((await handleOrderRequest(request(payload, { "Sec-Fetch-Site": "cross-site" }), service)).status, 403);
assert.equal((await handleOrderRequest(request(payload, { "Content-Type": "text/plain" }), service)).status, 415);

// All partial failure combinations; retry sends only the previously failed envelope.
for (const failingRecipient of [config.ordersEmail, payload.customer.email, "both"]) {
  const attempts = [];
  let recorded = 0;
  let fail = true;
  const partial = createOrderSubmissionService(config, async message => {
    attempts.push(message);
    if (fail && (message.to === failingRecipient || failingRecipient === "both")) throw Object.assign(new Error(config.password), { code: "EAUTH", response: config.password });
  }, async order => { recorded++; return order; });
  const first = await handleOrderRequest(request(), partial);
  assert.equal(first.status, failingRecipient === payload.customer.email ? 200 : 502);
  assert.equal(attempts.length, 2);
  assert(!(await first.text()).includes(config.password));
  fail = false;
  assert.equal((await handleOrderRequest(request(), partial)).status, 200);
  assert.equal(attempts.length, failingRecipient === "both" ? 4 : 3);
  assert.equal(attempts[0].date.toISOString(), attempts.at(-1).date.toISOString());
  assert.equal((await handleOrderRequest(request(), partial)).status, 200);
  assert.equal(attempts.length, failingRecipient === "both" ? 4 : 3);
  assert.equal(recorded, 1); // SMTP retries must not append another TXT row.
}
assert(logs.some(args => JSON.stringify(args).includes(receipt.id)));
assert(!JSON.stringify(logs).includes(config.password));
assert(!JSON.stringify(logs).includes(payload.customer.phone));
assert.equal(safeEmailError({ code: config.password }), "email_delivery_failed");

let release;
const pending = new Promise(resolve => { release = resolve; });
let concurrentSends = 0;
let concurrentRecords = 0;
const concurrent = createOrderSubmissionService(config, async () => { concurrentSends++; }, async order => {
  concurrentRecords++;
  await pending;
  return order;
});
const first = handleOrderRequest(request(), concurrent);
const second = handleOrderRequest(request(), concurrent);
// Let request parsing and both submissions reach the pending transport.
await new Promise(resolve => setTimeout(resolve, 10));
assert.equal(concurrentSends, 0); // No message can start while the file write is pending.
release();
assert.equal((await first).status, 200);
assert.equal((await second).status, 200);
assert.equal(concurrentSends, 2);
assert.equal(concurrentRecords, 1);

// A failed append/fsync forbids BOTH SMTP attempts and remains retryable.
let diskFail = true;
let diskAttempts = 0;
let sendsAfterWrite = 0;
const diskService = createOrderSubmissionService(config, async () => { sendsAfterWrite++; }, async order => {
  diskAttempts++;
  if (diskFail) throw new Error(`private-disk-error ${config.password}`);
  return { ...order, createdAt: "2026-10-31T23:30:00.123Z" };
});
const diskFailure = await handleOrderRequest(request(), diskService);
assert.equal(diskFailure.status, 503);
assert(!(await diskFailure.text()).includes(config.password));
assert.equal(sendsAfterWrite, 0);
diskFail = false;
const diskSuccess = await handleOrderRequest(request(), diskService);
assert.equal(diskSuccess.status, 200);
assert.equal((await diskSuccess.json()).createdAt, "2026-10-31T23:30:00.123Z");
assert.equal(sendsAfterWrite, 2);
assert.equal(diskAttempts, 2);
assert(logs.some(args => JSON.stringify(args).includes("order_record_write_failed")));
assert(!JSON.stringify(logs).includes(config.password));
assert(!JSON.stringify(logs).includes("private-disk-error"));

// TLS modes are explicit and certificate validation cannot be disabled in JSON.
const tls = smtpOptions(config);
assert.equal(tls.secure, true);
assert.equal(tls.port, 465);
assert.equal(tls.tls.rejectUnauthorized, true);
assert.equal(tls.tls.servername, config.host);
assert.equal(tls.tls.minVersion, "TLSv1.2");
assert.equal(tls.auth.pass, config.password);
const starttls = smtpOptions({ ...config, encryption: "starttls", port: 587 });
assert.equal(starttls.secure, false);
assert.equal(starttls.requireTLS, true);
assert.equal(starttls.ignoreTLS, false);
assert.equal(smtpConfigSchema.safeParse({ ...config, encryption: "none" }).success, false);
assert.equal(smtpConfigSchema.safeParse({ ...config, rejectUnauthorized: false }).success, false);
assert.equal(smtpConfigSchema.safeParse({ ...config, ordersEmail: "other@example.com, third@example.com" }).success, false);
assert.equal(smtpConfigSchema.safeParse({ ...config, fromName: "Bad\r\nBcc: third@example.com" }).success, false);
await smtpSender(config)(customer);
assert.equal(transportOptions.secure, true);
assert.equal(closeCount, 1);
transportResult = { accepted: [], rejected: ["test@example.com"] };
await assert.rejects(smtpSender(config)(customer), error => error.code === "EENVELOPE");
transportError = Object.assign(new Error(config.password), { code: "EAUTH" });
await assert.rejects(smtpSender(config)(customer), error => error.code === "EAUTH");
assert.equal(closeCount, 3);

// Config is read from a private file at runtime, never imported into a bundle.
const temp = mkdtempSync(path.join(os.tmpdir(), "magic-klick-email-test-"));
const oldPath = process.env.MAGIC_KLICK_EMAIL_CONFIG;
const oldMode = process.env.NODE_ENV;
try {
  delete process.env.MAGIC_KLICK_EMAIL_CONFIG;
  assert.equal(loadServerEmailSettings(), null);
  const filename = path.join(temp, "order-email.json");
  process.env.MAGIC_KLICK_EMAIL_CONFIG = filename;
  process.env.NODE_ENV = "production";
  writeFileSync(filename, JSON.stringify(config));
  assert.equal(loadServerEmailSettings().password, config.password);
  writeFileSync(filename, JSON.stringify({ ...config, enabled: false, password: "" }));
  assert.equal(loadServerEmailSettings(), null);
  writeFileSync(filename, JSON.stringify({ ...config, password: "" }));
  assert.throws(loadServerEmailSettings, /smtp_password_required/);
  process.env.MAGIC_KLICK_EMAIL_CONFIG = "private/order-email.json";
  assert.throws(loadServerEmailSettings, /must_be_absolute/);
  process.env.MAGIC_KLICK_EMAIL_CONFIG = path.resolve("config/order-email.example.json");
  assert.throws(loadServerEmailSettings, /outside_application/);
} finally {
  if (oldPath === undefined) delete process.env.MAGIC_KLICK_EMAIL_CONFIG; else process.env.MAGIC_KLICK_EMAIL_CONFIG = oldPath;
  if (oldMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldMode;
  rmSync(temp, { recursive: true });
}

const route = load("../app/api/orders/route.ts");
assert.equal((await (await route.GET()).json()).enabled, false);
assert.equal((await route.POST(request())).status, 503);
assert.equal(sent.length, beforeInvalid); // Reading/refreshing cannot trigger email.
for (let i = 0; i < 10; i++) assert.equal((await handleOrderRequest(request(payload, { "CF-Connecting-IP": "rate-test" }), service)).status, 200);
assert.equal((await handleOrderRequest(request(payload, { "CF-Connecting-IP": "rate-test" }), service)).status, 429);
console.log("PASS: two separate Serbian HTML/text messages, MIME, server totals, partial failures, retries/concurrency, validation, private config and strict TLS. No email or external request was sent; no order database was used.");
