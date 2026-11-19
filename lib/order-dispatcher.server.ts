import type { CartPayload } from "./cart";
import type { OrderReceipt } from "./orders";
import { snapshotOrder, type OrderEmailSnapshot } from "./order-snapshot";
import { orderMessage, type EmailKind } from "./order-messages.server";
import type { SmtpConfig } from "./smtp-config.server";

export type OrderMessage = ReturnType<typeof orderMessage>;
export interface OrderSubmissionService {
  submit(payload: CartPayload, requestId: string): Promise<OrderReceipt | null>;
}
export class OrderConflictError extends Error {}
export class OrderCapacityError extends Error {}
export class OrderRecordError extends Error {}

// Never log raw SMTP errors/responses: they can contain credentials/customer data.
export function safeEmailError(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" && ["EAUTH", "ECONNECTION", "ESOCKET", "ETIMEDOUT", "EDNS", "EENVELOPE", "EMESSAGE", "ESTREAM", "ETLS", "ESEND", "EREQUIRETLS"].includes(code) ? code : "email_delivery_failed";
}

interface Submission {
  fingerprint: string;
  snapshot: OrderEmailSnapshot;
  sent: Record<EmailKind, boolean>;
  recorded: boolean;
  expires: number;
  active?: Promise<OrderReceipt | null>;
}

export function createOrderSubmissionService(
  config: SmtpConfig,
  send: (message: OrderMessage) => Promise<void>,
  record: (order: OrderEmailSnapshot) => Promise<OrderEmailSnapshot>,
  now = Date.now,
): OrderSubmissionService {
  // Bounded process-local retry protection, not persistent storage or a job queue.
  const submissions = new Map<string, Submission>();
  return {
    async submit(payload, requestId) {
      for (const [id, entry] of submissions) if (!entry.active && entry.expires <= now()) submissions.delete(id);
      const fingerprint = JSON.stringify(payload);
      let entry = submissions.get(requestId);
      if (entry && entry.fingerprint !== fingerprint) throw new OrderConflictError("request_id_reused");
      if (!entry) {
        if (submissions.size >= 2000) throw new OrderCapacityError("submission_capacity");
        entry = { fingerprint, snapshot: snapshotOrder(payload, requestId), sent: { internal: false, customer: false }, recorded: false, expires: now() + 24 * 60 * 60_000 };
        submissions.set(requestId, entry);
      }
      if (entry.active) return entry.active;
      const submission = entry;
      submission.active = (async () => {
        if (!submission.recorded) {
          try {
            submission.snapshot = await record(submission.snapshot);
            submission.recorded = true;
          } catch (error) {
            if (error instanceof OrderConflictError) throw error;
            console.error("[order-record]", { orderId: submission.snapshot.id, code: "order_record_write_failed" });
            throw new OrderRecordError("order_record_write_failed");
          }
        }
        // Separate SMTP envelopes; either failure still allows the other attempt.
        await Promise.all((["internal", "customer"] as const).map(async kind => {
          if (submission.sent[kind]) return;
          try {
            await send(orderMessage(submission.snapshot, kind, config));
            submission.sent[kind] = true;
          } catch (error) {
            console.error("[order-email]", { orderId: submission.snapshot.id, kind, code: safeEmailError(error) });
          }
        }));
        // Internal email acceptance confirms checkout after the mandatory TXT record.
        // Customer email failure alone
        // must not turn a successfully received order into a failed checkout.
        if (!submission.sent.internal) return null;
        const { id, createdAt, mode, total } = submission.snapshot;
        return { id, createdAt, mode, total };
      })().finally(() => { submission.active = undefined; });
      return submission.active;
    },
  };
}
