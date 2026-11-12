// POST /api/checkout  { items: [{ slug, variant, quantity }, ...] }  →  { url }  (the PayPal payment page)
// The whole cart becomes one PayPal order. Prices come from the catalog, never from the browser.
// Each PayPal line item's `sku` is "slug|variant", which the webhook reads back to place the Prodigi order.
import { paypal, money } from "../_lib/paypal.js";
import { findVariant, CURRENCY, SHIPPING } from "../_lib/catalog.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const MAX_LINES = 20, MAX_QTY = 10;

export async function onRequestPost({ request, env }) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) return json({ error: "Checkout is not set up yet." }, 503);

  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const raw = Array.isArray(input?.items) ? input.items : input?.slug ? [input] : [];
  if (!raw.length) return json({ error: "Your cart is empty." }, 400);
  if (raw.length > MAX_LINES) return json({ error: "Too many items in the cart." }, 400);

  // Merge repeated lines and check every one against the catalog.
  const lines = new Map();
  for (const it of raw) {
    const quantity = Math.floor(Number(it?.quantity) || 1);
    const found = findVariant(it?.slug, it?.variant);
    if (!found) return json({ error: "One of the items in your cart is no longer available." }, 404);
    const key = `${it.slug}|${it.variant}`;
    const prev = lines.get(key);
    const q = (prev ? prev.quantity : 0) + quantity;
    if (quantity < 1 || q > MAX_QTY) return json({ error: `Quantity must be between 1 and ${MAX_QTY}.` }, 400);
    lines.set(key, { key, slug: it.slug, option: it.variant, quantity: q, ...found });
  }

  const origin = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const items = [...lines.values()].map((l) => ({
    name: `${l.product.title} — ${l.option}`.slice(0, 127),
    sku: l.key.slice(0, 127),
    quantity: String(l.quantity),
    unit_amount: { currency_code: CURRENCY, value: money(l.variant.price) },
    category: "PHYSICAL_GOODS",
  }));
  const itemTotal = [...lines.values()].reduce((n, l) => n + l.variant.price * l.quantity, 0);

  let r;
  try { r = await paypal(env, "POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: "cart",
      description: "Bill Lin photography prints",
      amount: {
        currency_code: CURRENCY,
        value: money(itemTotal + SHIPPING.amount),
        breakdown: {
          item_total: { currency_code: CURRENCY, value: money(itemTotal) },
          shipping: { currency_code: CURRENCY, value: money(SHIPPING.amount) },
        },
      },
      items,
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Bill Lin",
          shipping_preference: "GET_FROM_FILE",
          user_action: "PAY_NOW",
          return_url: `${origin}/api/paypal-return`,
          cancel_url: `${origin}/cart.html`,
        },
      },
    },
  }); } catch (err) {
    // e.g. wrong PayPal keys: say so in the logs and in a short code the owner can read, never the keys themselves
    console.error(err);
    return json({ error: "Checkout is unavailable right now. Please try again in a moment.", code: err.code || "paypal_error" }, 503); // 503, not 502: the billlinphotos.com zone swaps a 502 for its own HTML error page
  }

  if (!r.ok) {
    console.error("PayPal order create failed", r.status, JSON.stringify(r.data).slice(0, 800));
    return json({ error: "Checkout is unavailable right now. Please try again in a moment.", code: `paypal_${r.status}`, issue: r.data?.details?.[0]?.issue || r.data?.name }, 503); // 503, not 502: the billlinphotos.com zone swaps a 502 for its own HTML error page
  }
  const link = (r.data.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!link) return json({ error: "Checkout is unavailable right now. Please try again in a moment." }, 503); // 503, not 502: the billlinphotos.com zone swaps a 502 for its own HTML error page
  return json({ url: link.href });
}
