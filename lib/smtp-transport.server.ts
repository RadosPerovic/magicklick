import nodemailer from "nodemailer";
import type { SmtpConfig } from "./smtp-config.server";
import type { OrderMessage } from "./order-dispatcher.server";

export function smtpOptions(config: SmtpConfig) {
  return {
    host: config.host, port: config.port,
    secure: config.encryption === "implicit-tls",
    requireTLS: config.encryption === "starttls", ignoreTLS: false,
    auth: { user: config.username, pass: config.password },
    tls: { rejectUnauthorized: true, servername: config.host, minVersion: "TLSv1.2" as const },
    connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 8_000,
    logger: false, debug: false,
    disableFileAccess: true, disableUrlAccess: true,
  };
}

export function smtpSender(config: SmtpConfig) {
  return async (message: OrderMessage): Promise<void> => {
    const transport = nodemailer.createTransport(smtpOptions(config));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Total deadline stays below the checkout's 30-second request timeout.
      const info = await Promise.race([
        transport.sendMail(message),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            transport.close();
            reject(Object.assign(new Error("smtp_deadline"), { code: "ETIMEDOUT" }));
          }, 20_000);
        }),
      ]);
      if (!info.accepted?.length || info.rejected?.length) throw Object.assign(new Error("recipient_not_accepted"), { code: "EENVELOPE" });
    } finally {
      clearTimeout(timer);
      transport.close();
    }
  };
}
