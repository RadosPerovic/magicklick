import { chmodSync, copyFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";

export function packageNodeConfig(projectRoot = process.cwd()) {
  const root = realpathSync(projectRoot);
  const source = realpathSync(path.join(root, "private", "order-email.json"));
  if (/(^|[\\/])(public|public_html|www|htdocs)([\\/]|$)/i.test(source)) {
    throw new Error("email_config_must_be_outside_public_files");
  }
  // Validate JSON without printing file contents, credentials or parser excerpts.
  try { JSON.parse(readFileSync(source, "utf8").replace(/^\uFEFF/, "")); }
  catch { throw new Error("project_email_config_invalid_json"); }

  const standalone = path.join(root, "dist", "standalone");
  const serverPath = path.join(standalone, "server.js");
  const server = readFileSync(serverPath, "utf8");
  const privateDirectory = path.join(standalone, "private");
  mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
  const target = path.join(privateDirectory, "order-email.json");
  copyFileSync(source, target);
  chmodSync(target, 0o600);

  // The generated server uses paths relative to its deployment root even when
  // launched with `node /absolute/path/server.js` from another directory.
  const initializeRoot = "process.chdir(import.meta.dirname);\n";
  if (!server.includes(initializeRoot)) {
    const shebangEnd = server.startsWith("#!") ? server.indexOf("\n") + 1 : 0;
    writeFileSync(serverPath, server.slice(0, shebangEnd) + initializeRoot + server.slice(shebangEnd));
  }
}
