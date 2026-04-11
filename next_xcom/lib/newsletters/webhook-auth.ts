/**
 * Validates Zapier (or other clients) calling the newsletters webhook.
 * Set `NEWSLETTERS_WEBHOOK_SECRET` and send either header `x-newsletters-secret: <secret>`
 * or `Authorization: Bearer <secret>`.
 */
export function verifyNewslettersWebhook(request: Request): boolean {
  const secret = process.env.NEWSLETTERS_WEBHOOK_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    console.warn(
      "[newsletters] NEWSLETTERS_WEBHOOK_SECRET is unset; accepting webhook requests in non-production only"
    );
    return true;
  }
  const header = request.headers.get("x-newsletters-secret")?.trim();
  if (header && header === secret) return true;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return Boolean(bearer && bearer === secret);
}
