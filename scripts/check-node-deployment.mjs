import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const standalone = path.join(projectRoot, "dist", "standalone");
const source = await readFile(path.join(projectRoot, "private", "order-email.json"));
const copied = await readFile(path.join(standalone, "private", "order-email.json"));
assert.ok(source.equals(copied), "Standalone settings must match the project file");
const settings = JSON.parse(source.toString("utf8").replace(/^\uFEFF/, ""));
const expectedEnabled = settings.enabled === true && typeof settings.password === "string" && settings.password.trim().length > 0;

async function publicFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await publicFiles(filename));
    else result.push(filename);
  }
  return result;
}

// Never print credential values, even on a failed assertion.
for (const filename of await publicFiles(path.join(standalone, "dist", "client"))) {
  assert.notEqual(path.basename(filename), "order-email.json", "Private settings cannot be a public asset");
  if (settings.password && /\.(js|mjs|json|map|html|txt)$/i.test(filename)) {
    const content = await readFile(filename);
    assert.ok(!content.includes(Buffer.from(settings.password)), "SMTP password cannot appear in client assets");
  }
}

const unrelatedWorkingDirectory = path.join(projectRoot, "outputs", "node-deployment-check");
await mkdir(unrelatedWorkingDirectory, { recursive: true });
const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const { port } = reservation.address();
await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
const environment = { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port) };
delete environment.MAGIC_KLICK_EMAIL_CONFIG;
const child = spawn(process.execPath, [path.join(standalone, "app.cjs")], {
  cwd: unrelatedWorkingDirectory, env: environment, stdio: "ignore", windowsHide: true,
});
const exited = once(child, "exit");
const base = `http://127.0.0.1:${port}`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let ready = false;
  for (let attempt = 0; attempt < 60 && child.exitCode === null; attempt++) {
    try {
      const response = await fetch(`${base}/api/orders`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        const status = await response.json();
        assert.equal(status.enabled, expectedEnabled, "Production API must use the bundled project settings");
        assert.deepEqual(Object.keys(status), ["enabled"], "API exposes only readiness, never SMTP settings");
        ready = true;
        break;
      }
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
    }
    await pause(250);
  }
  assert.ok(ready, "The standalone Node server must start and respond");
  for (const route of ["/private/order-email.json", "/config/order-email.example.json", "/dist/standalone/private/order-email.json"]) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 404, "Configuration files must not be served over HTTP");
  }
  assert.equal((await fetch(base)).status, 200, "Home page remains available");
  console.log("PASS: standalone production loads bundled settings without an env path, starts from another directory, keeps credentials out of client assets and returns 404 for config URLs. No order or email was sent.");
} finally {
  if (child.exitCode === null) child.kill();
  await exited;
}
