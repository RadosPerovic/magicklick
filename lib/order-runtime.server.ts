import { createOrderSubmissionService, type OrderSubmissionService } from "./order-dispatcher.server";
import { loadServerEmailSettings } from "./smtp-config.server";
import { smtpSender } from "./smtp-transport.server";
import { createOrderRecorder } from "./order-record.server";

let service: OrderSubmissionService | undefined;
export function getOrderService(): OrderSubmissionService | null {
  if (service) return service;
  const config = loadServerEmailSettings();
  if (!config) return null;
  service = createOrderSubmissionService(config, smtpSender(config), createOrderRecorder());
  return service;
}
