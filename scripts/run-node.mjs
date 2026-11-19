import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { packageNodeConfig } from "./package-node-config.mjs";

const [command, ...args] = process.argv.slice(2);
if (!["dev", "build", "start"].includes(command)) throw new Error("Expected dev, build or start.");
process.env.MAGIC_KLICK_RUNTIME = "node";
const cli = new URL("../node_modules/vinext/dist/cli.js", import.meta.url);
if (command === "build") {
  // vinext exits its process after emitting standalone output. Package settings
  // in this parent process only after a successful build.
  const result = spawnSync(process.execPath, [fileURLToPath(cli), command, ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  packageNodeConfig();
  console.log("  Included private/order-email.json in the standalone Node deployment.\n");
  process.exit(0);
}
process.argv = [process.execPath, fileURLToPath(cli), command, ...args];
await import(cli.href);
