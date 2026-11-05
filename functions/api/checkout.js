// POST /api/checkout  { slug, variant, quantity }  →  { url }  (the Stripe checkout page)
import { stripe } from "../_lib/stripe.js";
import { findVariant, CURRENCY, SHIPPING, SHIP_TO } from "../_lib/catalog.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Checkout is not set up yet." }, 503);

  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const { slug, variant } = input || {};
  const quantity = Math.floor(Number(input?.quantity) || 1);
  if (quantity < 1 || quantity > 10) return json({ error: "Quantity must be between 1 and 10." }, 400);

  const found = findVariant(slug, variant);
  if (!found) return json({ error: "That product option is not available." }, 404);
  const { product, variant: v } = found;

  const origin = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const meta = { slug, variant, quantity };

  const session = await stripe(env, "POST", "/checkout/sessions", {
    mode: "payment",
    success_url: `${origin}/order-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${slug}.html`,
    line_items: [{
      quantity,
      price_data: {
        currency: CURRENCY,
        unit_amount: v.price,
        product_data: { name: `${product.title} — ${variant}`, images: [origin + product.image] },
      },
    }],
    shipping_address_collection: { allowed_countries: SHIP_TO },
    shipping_options: [{
      shipping_rate_data: { type: "fixed_amount", display_name: SHIPPING.label, fixed_amount: { amount: SHIPPING.amount, currency: CURRENCY } },
    }],
    phone_number_collection: { enabled: true },
    metadata: meta,
    payment_intent_data: { metadata: meta },
  });

  return json({ url: session.url });
}
