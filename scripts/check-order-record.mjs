import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { appendFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const url = new URL(relative, import.meta.url);
  if (cache.has(url.href)) return cache.get(url.href);
  const exports = {};
  cache.set(url.href, exports);
  const source = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports, process, Buffer, setTimeout, clearTimeout, crypto: globalThis.crypto,
    console: { error() {} },
    require(name) {
      if (name.startsWith("node:")) return nodeRequire(name);
      if (name.startsWith("./")) return load(new URL(`${name}.ts`, url).href);
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}
const { createOrderRecorder } = load("../lib/order-record.server.ts");
const { snapshotOrder } = load("../lib/order-snapshot.ts");
const { createOrderSubmissionService } = load("../lib/order-dispatcher.server.ts");
const payload = {
  items: [{ productId: "auto", quantity: 1, hooks: false }], delivery: "courier", pickupLocation: "",
  customer: { name: "Ana Marija Petrović", phone: "0641234567", email: "test@example.com", address: "Test ulica 12", postalCode: "11000", city: "Beograd", note: "" },
};
function order(date = "2026-11-19T10:15:12.123Z", customer = {}) {
  return { ...snapshotOrder({ ...payload, customer: { ...payload.customer, ...customer } }, randomUUID()), createdAt: date };
}
async function rows(filename) {
  const text = await readFile(filename, "utf8");
  assert(text.endsWith("\n"));
  return text.slice(0, -1).split("\n").filter(line => line.trim() !== "").map(line => {
    if (/^#\d+\t/.test(line)) {
      const [number, ...fields] = line.split("\t");
      return { number, ...Object.fromEntries(fields.map(field => {
        const equal = field.indexOf("=");
        return [field.slice(0, equal), JSON.parse(field.slice(equal + 1))];
      })) };
    }
    const number = line.slice(0, line.indexOf(","));
    const rest = line.slice(number.length);
    const fields = [...rest.matchAll(/,([A-Za-z]+)=("(?:[^"\\]|\\.)*")/g)];
    assert.equal(fields.map(field => field[0]).join(""), rest);
    return { number, ...Object.fromEntries(fields.map(field => [field[1], JSON.parse(field[2])])) };
  });
}

// Spawned writers exercise the same exclusive filesystem lock across processes.
if (process.argv[2] === "--writer") {
  const record = createOrderRecorder({ directory: process.argv[3], appRoot: process.argv[4] });
  await Promise.all(Array.from({ length: 6 }, () => record(order())));
  process.exit(0);
}

const temp = await mkdtemp(path.join(os.tmpdir(), "magic-klick-order-record-test-"));
const appRoot = path.join(temp, "app");
const directory = path.join(temp, "orders");
await mkdir(appRoot);
const november = path.join(directory, "2026-11.txt");
const december = path.join(directory, "2026-12.txt");
try {
  // No machine-specific setting is needed. The same relative default works
  // beside different local/hosting application roots.
  const oldDirectory = process.env.MAGIC_KLICK_ORDERS_DIRECTORY;
  try {
    delete process.env.MAGIC_KLICK_ORDERS_DIRECTORY;
    for (const location of ["local", "hosting"]) {
      const portableApp = path.join(temp, location, "magic-klick");
      await mkdir(portableApp, { recursive: true });
      const defaultRecorder = createOrderRecorder({ appRoot: portableApp });
      await defaultRecorder(order());
      const defaultFile = path.join(temp, location, "orders", "2026-11.txt");
      assert.equal((await rows(defaultFile)).length, 1);
      const relativeRecorder = createOrderRecorder({ appRoot: portableApp, directory: "../orders" });
      await relativeRecorder(order());
      assert.equal((await rows(defaultFile))[1].number, "#2");
      process.env.MAGIC_KLICK_ORDERS_DIRECTORY = "../orders";
      await createOrderRecorder({ appRoot: portableApp })(order());
      assert.equal((await rows(defaultFile))[2].number, "#3");
      delete process.env.MAGIC_KLICK_ORDERS_DIRECTORY;
    }
  } finally {
    if (oldDirectory === undefined) delete process.env.MAGIC_KLICK_ORDERS_DIRECTORY;
    else process.env.MAGIC_KLICK_ORDERS_DIRECTORY = oldDirectory;
  }
  const record = createOrderRecorder({ directory, appRoot });
  const initial = order("2026-10-31T23:30:00.123Z"); // November in Belgrade.
  await record(initial);
  const first = (await rows(november))[0];
  assert.equal(first.number, "#1");
  assert.equal(first.OrderId, initial.id);
  assert.equal(first.ImePrezime, payload.customer.name);
  assert.equal(first.Telefon, "0641234567");
  assert.equal(first.Ime, undefined);
  assert.equal(first.Prezime, undefined);
  assert((await readFile(november, "utf8")).startsWith('#1,OrderId="'));
  assert(!(await readFile(november, "utf8")).includes("\t"));
  assert.equal(first.Adresa, "Test ulica 12, 11000 Beograd");
  assert.equal(first.EmailAdresa, "test@example.com");
  assert.equal(first.VremePorudzbine, "2026-11-01T00:30:00.123+01:00");
  assert.match(first.KontrolniZbir, /^[a-f0-9]{64}$/);
  if (process.platform !== "win32") {
    assert.equal((await lstat(november)).mode & 0o077, 0);
    assert.equal((await lstat(directory)).mode & 0o077, 0);
  }

  const pasted = order(undefined, { name: 'Ana  "Mara", Petrović \\ Test\n#900\tOrderId="fake"', phone: "+381 (64) 123-4567", address: "Test,\r\nAdresa\t12\u2028\u2029" });
  await record(pasted);
  assert.equal((await rows(november)).length, 2);
  assert.equal((await rows(november))[1].number, "#2");
  assert.equal((await rows(november))[1].ImePrezime, pasted.customer.name);
  assert.equal((await rows(november))[1].Telefon, pasted.customer.phone);
  assert.match(await readFile(november, "utf8"), /\n\n#2,/);
  assert(!(await readFile(november, "utf8")).includes("\n\n\n"));
  assert.equal((await rows(november))[1].Adresa, `${pasted.customer.address}, 11000 Beograd`);
  assert((await rows(november))[1].Adresa.includes("\n"));
  const decemberOrder = order("2026-11-30T23:30:00.000Z");
  await record(decemberOrder);
  assert.equal((await rows(december))[0].number, "#1");

  // Retry after a restart and even in a later month: same row and original time.
  const restarted = createOrderRecorder({ directory, appRoot });
  const restored = await restarted({ ...initial, createdAt: "2026-12-02T10:00:00.000Z" });
  assert.equal(restored.createdAt, initial.createdAt);
  assert.equal((await rows(november)).length, 2);
  assert.equal((await rows(december)).length, 1);
  await assert.rejects(restarted({ ...initial, customer: { ...initial.customer, email: "other@example.com" } }), /request_id_reused/);

  // Existing tab-separated logs remain readable and retain their numbering,
  // timestamps and deduplication when the new comma-separated rows are appended.
  const legacyDirectory = path.join(temp, "legacy-orders");
  const legacyRecord = createOrderRecorder({ directory: legacyDirectory, appRoot });
  const legacyOrder = order();
  await legacyRecord(legacyOrder);
  const legacyFile = path.join(legacyDirectory, "2026-11.txt");
  const original = (await rows(legacyFile))[0];
  const oldColumns = ["OrderId", "Ime", "Prezime", "Adresa", "EmailAdresa", "VremePorudzbine", "KontrolniZbir"];
  const oldValues = { ...original, Ime: "Ana", Prezime: "Marija Petrović" };
  const legacyLine = `#1\t${oldColumns.map(column => `${column}=${JSON.stringify(oldValues[column])}`).join("\t")}\n`;
  await writeFile(legacyFile, legacyLine);
  assert.equal((await legacyRecord({ ...legacyOrder, createdAt: "2026-12-02T10:00:00.000Z" })).createdAt, legacyOrder.createdAt);
  const previousCommaOrder = order();
  await legacyRecord(previousCommaOrder);
  const mixed = await readFile(legacyFile, "utf8");
  assert(mixed.startsWith(legacyLine));
  assert(mixed.startsWith(`${legacyLine}\n#2,OrderId="`));
  assert.equal((await rows(legacyFile)).length, 2);
  await legacyRecord(legacyOrder);
  assert.equal((await rows(legacyFile)).length, 2);

  // The previous comma-separated format had no phone column and no blank
  // separator. It can coexist with both the original and current formats.
  const oldCommaLine = mixed.split("\n").filter(Boolean)[1].replace(/,Telefon="(?:[^"\\]|\\.)*"/, "");
  await writeFile(legacyFile, `${legacyLine}${oldCommaLine}\n`);
  await legacyRecord(previousCommaOrder);
  assert.equal((await rows(legacyFile)).length, 2);
  await legacyRecord(order());
  assert.equal((await rows(legacyFile)).length, 3);
  assert.match(await readFile(legacyFile, "utf8"), /\n\n#3,.*Telefon="0641234567"/);

  // Recover an unconfirmed partial append while preserving complete orders.
  await appendFile(november, '#3\tOrderId="interrupted');
  await record(order());
  assert.equal((await rows(november)).length, 3);
  assert.equal((await rows(november))[2].number, "#3");

  // An interrupted append may leave just its separator; don't add another.
  await appendFile(november, "\n");
  await record(order());
  const afterSeparator = await readFile(november, "utf8");
  assert.match(afterSeparator, /\n\n#4,/);
  assert(!afterSeparator.includes("\n\n\n#4,"));

  const summer = order("2026-07-15T10:00:00.000Z");
  summer.deliveryMethod = "post-office";
  summer.customer.address = "";
  summer.customer.city = "";
  await record(summer);
  const summerRow = (await rows(path.join(directory, "2026-07.txt")))[0];
  assert.equal(summerRow.VremePorudzbine, "2026-07-15T12:00:00.000+02:00");
  assert.equal(summerRow.Adresa, "Pošta 11000 (preuzimanje u pošti)");

  await assert.rejects(createOrderRecorder({ directory: path.join(appRoot, "orders"), appRoot })(order()), /outside_application/);
  await assert.rejects(createOrderRecorder({ directory: path.join(temp, "public_html", "orders"), appRoot })(order()), /outside_application/);
  await assert.rejects(createOrderRecorder({ directory: "./orders", appRoot })(order()), /outside_application/);
  await assert.rejects(createOrderRecorder({ directory: "../public_html/orders", appRoot })(order()), /outside_application/);
  const junction = path.join(temp, "app-alias");
  await symlink(await realpath(appRoot), junction, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(createOrderRecorder({ directory: path.join(junction, "orders"), appRoot })(order()), /outside_application/);

  // A busy/abandoned lock fails closed and cannot start either email.
  await writeFile(path.join(directory, ".orders.lock"), "");
  const lockedRecord = createOrderRecorder({ directory, appRoot, lockTimeoutMs: 75 });
  const config = { fromName: "Test", fromEmail: "sender@example.com", ordersEmail: "internal@example.com" };
  let sent = 0;
  const service = createOrderSubmissionService(config, async () => {
    // This is the actual monthly file, already completely written and fsynced.
    assert((await rows(november)).some(row => row.OrderId === expectedId));
    sent++;
  }, snapshot => lockedRecord({ ...snapshot, createdAt: "2026-11-19T10:15:12.123Z" }));
  const requestId = randomUUID();
  const expectedId = `MK-${requestId.toUpperCase()}`;
  await assert.rejects(service.submit(payload, requestId), /order_record_write_failed/);
  assert.equal(sent, 0);
  await unlink(path.join(directory, ".orders.lock"));
  assert.equal((await service.submit(payload, requestId)).id, expectedId);
  assert.equal(sent, 2);
  const count = (await rows(november)).length;
  await service.submit(payload, requestId);
  assert.equal((await rows(november)).length, count);
  assert.equal(sent, 2);

  const invalidDirectory = path.join(temp, "blocked");
  await writeFile(invalidDirectory, "not a directory");
  const blocked = createOrderSubmissionService(config, async () => { sent++; }, createOrderRecorder({ directory: invalidDirectory, appRoot }));
  await assert.rejects(blocked.submit(payload, randomUUID()), /order_record_write_failed/);
  assert.equal(sent, 2);

  // Simulate a real file-handle fsync failure AFTER the full line was appended.
  // No SMTP is allowed; the next attempt must flush/reuse that same row.
  const syncDirectory = path.join(temp, "sync-failure");
  const syncRecord = createOrderRecorder({ directory: syncDirectory, appRoot });
  const promises = nodeRequire("node:fs/promises");
  const originalOpen = promises.open;
  let failSync = true;
  let syncSends = 0;
  const syncService = createOrderSubmissionService(config, async () => { syncSends++; },
    snapshot => syncRecord({ ...snapshot, createdAt: "2026-11-19T10:15:12.123Z" }));
  const syncRequestId = randomUUID();
  try {
    promises.open = async (...args) => {
      const handle = await originalOpen(...args);
      if (failSync && args[0] === path.join(syncDirectory, "2026-11.txt")) {
        handle.sync = async () => { throw Object.assign(new Error("fake disk sync failure"), { code: "EIO" }); };
      }
      return handle;
    };
    await assert.rejects(syncService.submit(payload, syncRequestId), /order_record_write_failed/);
    assert.equal(syncSends, 0);
    failSync = false;
    assert.equal((await syncService.submit(payload, syncRequestId)).id, `MK-${syncRequestId.toUpperCase()}`);
    assert.equal(syncSends, 2);
    assert.equal((await rows(path.join(syncDirectory, "2026-11.txt"))).length, 1);
  } finally { promises.open = originalOpen; }

  const corruptDirectory = path.join(temp, "corrupt");
  await mkdir(corruptDirectory);
  const corruptFile = path.join(corruptDirectory, "2026-11.txt");
  await writeFile(corruptFile, "invalid complete row\n");
  await assert.rejects(createOrderRecorder({ directory: corruptDirectory, appRoot })(order()), /invalid_format/);
  assert.equal(await readFile(corruptFile, "utf8"), "invalid complete row\n");

  const shared = path.join(temp, "concurrent-orders");
  function writer() {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--writer", shared, appRoot], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
      let stderr = "";
      child.stderr.on("data", data => { stderr += data; });
      child.on("error", reject);
      child.on("close", code => code === 0 ? resolve() : reject(new Error(`Writer failed (${code}): ${stderr}`)));
    });
  }
  await Promise.all([writer(), writer(), writer()]);
  const concurrentRows = await rows(path.join(shared, "2026-11.txt"));
  assert.equal(concurrentRows.length, 18);
  assert.equal(new Set(concurrentRows.map(row => row.OrderId)).size, 18);
  concurrentRows.forEach((row, index) => assert.equal(row.number, `#${index + 1}`));
  concurrentRows.forEach(row => assert.equal(row.Telefon, payload.customer.phone));
  const concurrentLines = (await readFile(path.join(shared, "2026-11.txt"), "utf8")).trimEnd().split("\n");
  assert.equal(concurrentLines.length, 35); // 18 order rows and 17 blank separators.
  concurrentLines.forEach((line, index) => assert(index % 2 === 0 ? line.startsWith(`#${index / 2 + 1},`) : line === ""));
  assert(!(await readdir(shared)).includes(".orders.lock"));
  console.log("PASS: private monthly TXT records, numbering, Belgrade month/DST, restart deduplication, multiline input, interrupted append recovery, filesystem failures, symlink checks and three concurrent Node processes. No email was sent.");
} finally {
  // Only remove the exact temporary fixture directory created above.
  const resolved = path.resolve(temp);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert(path.basename(resolved).startsWith("magic-klick-order-record-test-"));
  await rm(resolved, { recursive: true, force: true });
}
