import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Execute the real TypeScript business logic without adding a test dependency.
function load(path, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, crypto: globalThis.crypto, setTimeout });
  return exports;
}
const catalog = load("../lib/catalog.ts");
const orders = load("../lib/orders.ts", { "./catalog": catalog });
const { addCartItem, parseCartItems, calculateCartQuote, submitDemoCartOrder } = load("../lib/cart.ts", { "./catalog": catalog, "./orders": orders });
const auto = { productId: "auto", quantity: 2, hooks: true };
const moto = { productId: "moto", quantity: 1, hooks: false };
const items = addCartItem(addCartItem([], auto), moto);
const courier = calculateCartQuote(items, "courier");
assert.equal(orders.calculateQuote({ productId: "moto", quantity: 1, hooks: false, delivery: "courier", pickupLocation: "" }).total, 2100);
assert.equal(orders.calculateQuote({ productId: "hooks", quantity: 1, hooks: false, delivery: "courier", pickupLocation: "" }).total, 1100);
assert.equal(calculateCartQuote([{ productId: "moto", quantity: 1, hooks: true }], "pickup").subtotal, 1500);
assert.equal(orders.calculateQuote({ productId: "moto", quantity: 1, hooks: true, delivery: "courier", pickupLocation: "" }).extras, 0);
assert.equal(addCartItem([], { ...moto, hooks: true })[0].hooks, false);
assert.equal(parseCartItems(JSON.stringify([{ ...moto, hooks: true }]))[0].hooks, false);
assert.equal(calculateCartQuote([{ productId: "hooks", quantity: 3, hooks: false }], "pickup").subtotal, 1500);
assert.equal(courier.subtotal, 3800);
assert.equal(courier.extras, 300);
assert.equal(courier.delivery, 600); // Charged once across the whole basket.
assert.equal(courier.total, 4400);
assert.equal(calculateCartQuote(items, "post-office").delivery, 480);
assert.equal(calculateCartQuote(items, "post-office").total, 4280);
assert.equal(orders.calculateQuote({ productId: "hooks", quantity: 1, hooks: false, delivery: "post-office", pickupLocation: "" }).total, 980);
assert.equal(calculateCartQuote([{ ...auto, quantity: 6, hooks: false }], "post-office").delivery, 0);
assert.equal(calculateCartQuote(items, "pickup").total, 3800);
assert.equal(calculateCartQuote([], "courier").total, 0);
assert.equal(calculateCartQuote([{ ...auto, quantity: 6, hooks: false }], "courier").delivery, 0);
assert.equal(calculateCartQuote([{ ...auto, quantity: 5, hooks: false }], "courier").delivery, 600);
const merged = addCartItem(items, { ...auto, quantity: 1, hooks: false });
assert.equal(merged.length, 2);
assert.equal(merged[0].quantity, 3);
assert.equal(merged[0].hooks, true);
assert.equal(calculateCartQuote(merged, "courier").extras, 300);
assert.equal(items[0].quantity, 2); // Adding doesn't mutate the prior cart/snapshot.
assert.throws(() => addCartItem(items, { ...auto, quantity: 20 }));
assert.throws(() => calculateCartQuote([{ ...auto, quantity: 0 }], "courier"));
assert.equal(parseCartItems(JSON.stringify(items)).length, 2);
assert.equal(parseCartItems("not-json").length, 0);
assert.equal(parseCartItems('[{"productId":"unknown","quantity":1,"hooks":false}]').length, 0);
assert.equal(parseCartItems(JSON.stringify([auto, auto])).length, 0);
assert.equal(parseCartItems(JSON.stringify([{ ...auto, quantity: 21 }])).length, 0);
assert.equal(parseCartItems(JSON.stringify([{ ...auto, customer: { name: "ignored" } }]))[0].customer, undefined);
const customer = { name: "Test Kupac", phone: "0641234567", email: "", city: "Beograd", postalCode: "11000", address: "Test ulica 12", note: "" };
assert.equal(Object.keys(orders.validateCustomer(customer, "courier")).length, 0);
assert(Object.keys(orders.validateCustomer({ ...customer, postalCode: "" }, "courier")).length > 0);
const postOfficeCustomer = { ...customer, city: "", address: "" };
assert.equal(Object.keys(orders.validateCustomer(postOfficeCustomer, "post-office")).length, 0);
assert(orders.validateCustomer({ ...postOfficeCustomer, postalCode: "" }, "post-office").postalCode);
assert(orders.validateCustomer({ ...postOfficeCustomer, phone: "" }, "post-office").phone);
assert(orders.validateCustomer({ ...postOfficeCustomer, name: "" }, "post-office").name);
assert(orders.validateCustomer(postOfficeCustomer, "courier").city);
assert(orders.validateCustomer(postOfficeCustomer, "courier").address);
const payload = { items, delivery: "courier", pickupLocation: "Novi Beograd", customer };
assert.equal((await submitDemoCartOrder(payload)).total, 4400);
assert.equal((await submitDemoCartOrder({ ...payload, delivery: "post-office", pickupLocation: "", customer: postOfficeCustomer })).total, 4280);
await assert.rejects(submitDemoCartOrder({ ...payload, delivery: "post-office", customer: { ...postOfficeCustomer, postalCode: "" } }));
await assert.rejects(submitDemoCartOrder({ ...payload, items: [] }));
await assert.rejects(submitDemoCartOrder({ ...payload, delivery: "pickup", pickupLocation: "invalid" }));
console.log("PASS: cart merging, promo pricing, shipping once per basket, free shipping, persistence validation, customer validation and demo confirmation.");
