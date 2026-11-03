import { handleOrderRequest, ordersEnabled, type OrderEmailConfig } from "@/lib/order-email.server";

export const dynamic = "force-dynamic";

function orderEmailConfig(): OrderEmailConfig {
  if (process.env.VERCEL === "1") return {};

  return {
    ORDERS_ENABLED: process.env.ORDERS_ENABLED,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ORDER_EMAIL_FROM: process.env.ORDER_EMAIL_FROM,
  };
}

export function GET() {
  return Response.json({ enabled: ordersEnabled(orderEmailConfig()) }, { headers: { "Cache-Control": "no-store" } });
}

export function POST(request: Request) {
  return handleOrderRequest(request, orderEmailConfig());
}
