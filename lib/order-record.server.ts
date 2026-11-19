import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { OrderConflictError } from "./order-dispatcher.server";
import type { OrderEmailSnapshot } from "./order-snapshot";

const columns = ["OrderId", "ImePrezime", "Telefon", "Adresa", "EmailAdresa", "VremePorudzbine", "KontrolniZbir"] as const;
const previousColumns = columns.filter(column => column !== "Telefon");
const legacyColumns = ["OrderId", "Ime", "Prezime", "Adresa", "EmailAdresa", "VremePorudzbine", "KontrolniZbir"] as const;
type RecordValues = Record<typeof columns[number], string>;
const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
const localDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "longOffset",
});

function orderTime(iso: string): string {
  const date = new Date(iso);
  const parts = Object.fromEntries(localDate.formatToParts(date).map(part => [part.type, part.value]));
  const offset = parts.timeZoneName.replace("GMT", "") || "+00:00";
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${String(date.getUTCMilliseconds()).padStart(3, "0")}${offset}`;
}

function recordValues(order: OrderEmailSnapshot): RecordValues {
  const { createdAt: _createdAt, ...content } = order;
  return {
    OrderId: order.id, ImePrezime: order.customer.name, Telefon: order.customer.phone,
    Adresa: order.deliveryMethod === "post-office"
      ? `Pošta ${order.customer.postalCode} (preuzimanje u pošti)`
      : `${order.customer.address}, ${order.customer.postalCode} ${order.customer.city}`,
    EmailAdresa: order.customer.email, VremePorudzbine: orderTime(order.createdAt),
    // Detect reuse of an ID with different customer data, products or amounts,
    // including after a process restart. The timestamp is restored from the log.
    KontrolniZbir: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
  };
}

function commaFields(line: string): string[] {
  const fields: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quoted && escaped) escaped = false;
    else if (quoted && char === "\\") escaped = true;
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") {
      fields.push(line.slice(start, index));
      start = index + 1;
    }
  }
  if (quoted || escaped) throw new Error("order_record_invalid_format");
  fields.push(line.slice(start));
  return fields;
}

function parseRows(content: string, month: string): RecordValues[] {
  if (!content) return [];
  return content.slice(0, -1).split("\n").filter(line => line.trim() !== "").map((line, index) => {
    const legacy = /^#\d+\t/.test(line);
    const fields = legacy ? line.split("\t") : commaFields(line);
    const rowColumns = legacy ? legacyColumns : fields.length === previousColumns.length + 1 ? previousColumns : columns;
    if (fields.length !== rowColumns.length + 1 || fields[0] !== `#${index + 1}`) throw new Error("order_record_invalid_format");
    const parsed: Record<string, string> = {};
    rowColumns.forEach((column, position) => {
      const field = fields[position + 1];
      if (!field.startsWith(`${column}=`)) throw new Error("order_record_invalid_column");
      const value: unknown = JSON.parse(field.slice(column.length + 1));
      if (typeof value !== "string") throw new Error("order_record_invalid_value");
      parsed[column] = value;
    });
    const values = parsed as RecordValues;
    if (legacy) values.ImePrezime = [parsed.Ime, parsed.Prezime].filter(Boolean).join(" ");
    if (!("Telefon" in parsed)) values.Telefon = "";
    if (!/^MK-[A-F0-9-]{36}$/.test(values.OrderId) || !/^[a-f0-9]{64}$/.test(values.KontrolniZbir)
      || !Number.isFinite(Date.parse(values.VremePorudzbine)) || values.VremePorudzbine.slice(0, 7) !== month) {
      throw new Error("order_record_invalid_value");
    }
    return values;
  });
}

function encode(value: string): string {
  // Each order is one physical line, even for pasted multiline input.
  return JSON.stringify(value).replace(/[\u0085\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

async function canonicalPath(filename: string): Promise<string> {
  try { return await realpath(filename); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = path.dirname(filename);
    if (parent === filename) throw error;
    return path.join(await canonicalPath(parent), path.basename(filename));
  }
}

function assertPrivateDirectory(directory: string, appRoot: string) {
  const relative = path.relative(appRoot, directory);
  const inside = relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
  if (inside || /(^|[\\/])(public|public_html|www|htdocs|dist|\.next)([\\/]|$)/i.test(directory)) {
    throw new Error("orders_directory_must_be_outside_application_and_public_files");
  }
}

async function syncDirectory(directory: string) {
  if (process.platform === "win32") return; // Windows does not support fsync on directory handles.
  const handle = await open(directory, constants.O_RDONLY);
  try { await handle.sync(); } finally { await handle.close(); }
}

async function readMonth(filename: string, month: string): Promise<{ rows: RecordValues[]; endsWithBlankLine: boolean }> {
  // Refuse symlinks even on platforms without O_NOFOLLOW.
  if (!(await lstat(filename)).isFile()) throw new Error("order_record_not_regular_file");
  const handle = await open(filename, constants.O_RDWR | noFollow);
  try {
    const data = await handle.readFile();
    const completeBytes = data.lastIndexOf(10) + 1;
    const complete = data.subarray(0, completeBytes).toString("utf8");
    const rows = parseRows(complete, month);
    if (completeBytes !== data.length) {
      // Recover a partial last write from disk-full/process interruption. A row
      // without its newline was never confirmed and could not trigger email.
      await handle.truncate(completeBytes);
    }
    await handle.sync();
    return { rows, endsWithBlankLine: /(?:^|\n)[ \t\r]*\n$/.test(complete) };
  } finally { await handle.close(); }
}

export function createOrderRecorder(options: { directory?: string; appRoot?: string; lockTimeoutMs?: number } = {}) {
  const appRoot = path.resolve(options.appRoot ?? process.cwd());
  const configured = options.directory ?? process.env.MAGIC_KLICK_ORDERS_DIRECTORY;
  // Resolve relative settings against the application working directory, never
  // against a URL or the location of a generated server chunk.
  const directory = path.resolve(appRoot, configured || "../orders");
  const lockTimeoutMs = options.lockTimeoutMs ?? 5_000;

  return async (order: OrderEmailSnapshot): Promise<OrderEmailSnapshot> => {
    const root = await realpath(appRoot);
    const target = await canonicalPath(directory);
    assertPrivateDirectory(target, root);
    await mkdir(target, { recursive: true, mode: 0o700 });
    const resolved = await realpath(target);
    assertPrivateDirectory(resolved, root);
    const lockPath = path.join(resolved, ".orders.lock");
    const deadline = Date.now() + lockTimeoutMs;
    let lock;
    while (!lock) {
      try { lock = await open(lockPath, "wx", 0o600); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (Date.now() >= deadline) throw new Error("orders_lock_timeout");
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
    try {
      const values = recordValues(order);
      const month = values.VremePorudzbine.slice(0, 7);
      let count = 0;
      let separator = "";
      let existing: RecordValues | undefined;
      const files = (await readdir(resolved)).filter(name => /^\d{4}-\d{2}\.txt$/.test(name)).sort();
      // Search older months too: retrying the same request at a month boundary
      // must not append another order or change the original timestamp.
      for (const file of files) {
        const saved = await readMonth(path.join(resolved, file), file.slice(0, 7));
        if (file === `${month}.txt`) {
          count = saved.rows.length;
          separator = count > 0 && !saved.endsWithBlankLine ? "\n" : "";
        }
        for (const row of saved.rows) if (row.OrderId === order.id) {
          if (existing) throw new Error("order_record_duplicate_id");
          existing = row;
        }
      }
      if (existing) {
        if (existing.KontrolniZbir !== values.KontrolniZbir) throw new OrderConflictError("request_id_reused");
        await syncDirectory(resolved);
        return { ...order, createdAt: new Date(existing.VremePorudzbine).toISOString() };
      }
      const line = `${separator}#${count + 1},${columns.map(column => `${column}=${encode(values[column])}`).join(",")}\n`;
      const filename = path.join(resolved, `${month}.txt`);
      const handle = await open(filename, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | noFollow, 0o600);
      try {
        if (!(await handle.stat()).isFile()) throw new Error("order_record_not_regular_file");
        await handle.writeFile(line, "utf8");
        await handle.sync(); // SMTP is forbidden until this succeeds.
      } finally { await handle.close(); }
      await syncDirectory(resolved);
      return order;
    } finally {
      await lock.close();
      await unlink(lockPath);
    }
  };
}
