// GET /api/paypal-return?token=ORDER_ID — PayPal sends the buyer here after they approve the payment.
// This takes the money (capture) and shows the thank-you page. The Prodigi order is placed by
// /api/paypal-webhook when PayPal confirms the payment, so it happens even if the buyer closes the tab.
import { paypal } from "../_lib/paypal.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("token");
  const site = (env.SITE_URL || url.origin).replace(/\/$/, "");
  if (!orderId) return Response.redirect(`${site}/shop.html`, 302);

  const r = await paypal(env, "POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, { "PayPal-Request-Id": `capture-${orderId}` });
  const issue = r.data?.details?.[0]?.issue;
  const captured = (r.ok && r.data.status === "COMPLETED") || issue === "ORDER_ALREADY_CAPTURED";
  if (captured) return Response.redirect(`${site}/order-success.html?order=${encodeURIComponent(orderId)}`, 302);

  // Card declined or payment not approved: back to the cart, which is still there, with a message.
  console.error("PayPal capture failed", r.status, JSON.stringify(r.data).slice(0, 500));
  return Response.redirect(`${site}/cart.html?payment=failed`, 302);
}
