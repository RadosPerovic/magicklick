declare namespace Cloudflare {
  interface Env {
    ORDERS_ENABLED?: string;
    RESEND_API_KEY?: string;
    ORDER_EMAIL_FROM?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
