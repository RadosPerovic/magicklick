import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const mailbox = z.string().trim().email().max(254).regex(/^[^\r\n<>]+$/);
export const smtpConfigSchema = z.object({
  enabled: z.boolean(),
  host: z.string().trim().min(1).max(253).regex(/^[a-zA-Z0-9.-]+$/),
  port: z.number().int().min(1).max(65535),
  encryption: z.enum(["implicit-tls", "starttls"]),
  username: z.string().trim().min(1).max(254).regex(/^[^\r\n]+$/),
  password: z.string(),
  fromEmail: mailbox,
  fromName: z.string().trim().min(1).max(120).regex(/^[^\r\n]+$/),
  ordersEmail: mailbox,
}).strict();

export type SmtpConfig = z.infer<typeof smtpConfigSchema>;

export function loadServerEmailSettings(): SmtpConfig | null {
  const configuredPath = process.env.MAGIC_KLICK_EMAIL_CONFIG;
  if (!configuredPath) return null;
  // Resolve symlinks as well: a secret must never be served as a static asset.
  if (!path.isAbsolute(configuredPath)) throw new Error("email_config_path_must_be_absolute");
  const filename = realpathSync(configuredPath);
  if (/(^|[\\/])(public|public_html|www|htdocs)([\\/]|$)/i.test(filename)) {
    throw new Error("email_config_must_be_outside_public_files");
  }
  const appRoot = realpathSync(process.cwd());
  const relative = path.relative(appRoot, filename);
  const withinApp = relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
  if (withinApp && (process.env.NODE_ENV === "production" || /^(public|dist|out|\.next)([\\/]|$)/i.test(relative))) {
    throw new Error("email_config_must_be_outside_application");
  }
  const smtp = smtpConfigSchema.parse(JSON.parse(readFileSync(filename, "utf8").replace(/^\uFEFF/, "")));
  if (!smtp.enabled) return null;
  if (!smtp.password.trim()) throw new Error("smtp_password_required");
  return smtp;
}
