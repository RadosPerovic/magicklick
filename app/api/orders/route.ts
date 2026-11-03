import { env } from "cloudflare:workers";
import { handleOrderRequest, ordersEnabled, type OrderEmailConfig } from "@/lib/order-email.server";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ enabled: ordersEnabled(env as OrderEmailConfig) }, { headers: { "Cache-Control": "no-store" } });
}

export function POST(request: Request) {
  return handleOrderRequest(request, env as OrderEmailConfig);
}
