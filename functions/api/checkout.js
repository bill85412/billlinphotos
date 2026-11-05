// POST /api/checkout  { slug, variant, quantity }  →  { url }  (the PayPal payment page)
import { paypal, money } from "../_lib/paypal.js";
import { findVariant, CURRENCY, SHIPPING } from "../_lib/catalog.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function onRequestPost({ request, env }) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) return json({ error: "Checkout is not set up yet." }, 503);

  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const { slug, variant } = input || {};
  const quantity = Math.floor(Number(input?.quantity) || 1);
  if (quantity < 1 || quantity > 10) return json({ error: "Quantity must be between 1 and 10." }, 400);

  const found = findVariant(slug, variant);
  if (!found) return json({ error: "That product option is not available." }, 404);
  const { product, variant: v } = found;

  const origin = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const itemTotal = v.price * quantity;

  const r = await paypal(env, "POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: slug,
      // what was bought, read back when the payment completes (PayPal allows 127 characters)
      custom_id: JSON.stringify({ s: slug, v: variant, q: quantity }).slice(0, 127),
      description: `${product.title} — ${variant}`.slice(0, 127),
      amount: {
        currency_code: CURRENCY,
        value: money(itemTotal + SHIPPING.amount),
        breakdown: {
          item_total: { currency_code: CURRENCY, value: money(itemTotal) },
          shipping: { currency_code: CURRENCY, value: money(SHIPPING.amount) },
        },
      },
      items: [{
        name: `${product.title} — ${variant}`.slice(0, 127),
        quantity: String(quantity),
        unit_amount: { currency_code: CURRENCY, value: money(v.price) },
        category: "PHYSICAL_GOODS",
      }],
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Bill Lin",
          shipping_preference: "GET_FROM_FILE",
          user_action: "PAY_NOW",
          return_url: `${origin}/api/paypal-return`,
          cancel_url: `${origin}/${slug}.html`,
        },
      },
    },
  });

  if (!r.ok) return json({ error: "Checkout is unavailable right now. Please try again in a moment." }, 502);
  const link = (r.data.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!link) return json({ error: "Checkout is unavailable right now. Please try again in a moment." }, 502);
  return json({ url: link.href });
}
