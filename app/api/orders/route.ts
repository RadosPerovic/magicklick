import { handleOrderRequest } from "@/lib/order-email.server";
import type { OrderSubmissionService } from "@/lib/order-dispatcher.server";

export const dynamic = "force-dynamic";

async function orderService(): Promise<OrderSubmissionService | null> {
  // Replaced at build time. The Worker build excludes Node SMTP and secret files.
  if (!__MAGIC_KLICK_NODE__) return null;
  try {
    const { getOrderService } = await import("@/lib/order-runtime.server");
    return getOrderService();
  } catch {
    console.error("[order-email]", { code: "email_configuration_invalid" });
    return null;
  }
}

export async function GET() {
  return Response.json({ enabled: !!(await orderService()) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  return handleOrderRequest(request, await orderService());
}
