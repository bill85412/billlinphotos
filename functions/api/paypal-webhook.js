// POST /api/paypal-webhook — PayPal calls this when a payment is captured.
// It checks with PayPal that the notification is genuine, reads the order from PayPal itself,
// sends it to Prodigi, and leaves a marker in R2 so the same payment is never printed twice.
import { paypal, verifyWebhook } from "../_lib/paypal.js";
import { createProdigiOrder } from "../_lib/prodigi.js";
import { findVariant, PRODIGI_SHIPPING_METHOD } from "../_lib/catalog.js";

const ok = (msg) => new Response(msg, { status: 200 });

export async function onRequestPost({ request, env }) {
  let event;
  try { event = JSON.parse(await request.text()); } catch { return new Response("Bad request", { status: 400 }); }
  if (!(await verifyWebhook(env, request, event))) return new Response("Invalid signature", { status: 400 });
  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") return ok("Ignored");

  const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
  if (!orderId) return ok("No order id");

  try {
    return ok(await fulfil(env, orderId, new URL(request.url).origin));
  } catch (err) {
    // A non-2xx answer makes PayPal send the notification again later.
    console.error(err);
    return new Response(String(err.message || err), { status: 500 });
  }
}

export async function fulfil(env, orderId, origin) {
  const markerKey = `orders/${orderId}.json`;
  if (env.PRINT_FILES) {
    const existing = await env.PRINT_FILES.get(markerKey);
    if (existing) return `Already sent to Prodigi (${orderId})`;
  }

  // Read the order from PayPal rather than trusting the notification body.
  const r = await paypal(env, "GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  if (!r.ok) throw new Error(`Could not read PayPal order ${orderId} (${r.status})`);
  const order = r.data;
  if (order.status !== "COMPLETED") return `Order ${orderId} is ${order.status}, not paid yet`;

  const unit = order.purchase_units?.[0] || {};
  let meta = {};
  try { meta = JSON.parse(unit.custom_id || "{}"); } catch {}
  const found = findVariant(meta.s, meta.v);
  if (!found) throw new Error(`Unknown product in paid PayPal order ${orderId}: ${unit.custom_id}`);

  const ship = unit.shipping;
  const a = ship?.address;
  if (!a?.address_line_1) throw new Error(`No shipping address on paid PayPal order ${orderId}`);
  const payer = order.payer || {};

  const prodigiOrder = {
    submit: true,
    merchantReference: orderId,
    shippingMethod: PRODIGI_SHIPPING_METHOD,
    recipient: {
      name: ship.name?.full_name || [payer.name?.given_name, payer.name?.surname].filter(Boolean).join(" "),
      email: payer.email_address || undefined,
      address: {
        line1: a.address_line_1,
        line2: a.address_line_2 || undefined,
        postalOrZipCode: a.postal_code,
        countryCode: a.country_code,
        townOrCity: a.admin_area_2,
        stateOrCounty: a.admin_area_1 || undefined,
      },
    },
    items: [{
      merchantReference: `${meta.s}:${meta.v}`,
      sku: found.variant.sku,
      quantity: Number(meta.q) || 1,
      sizing: "fillPrintArea",
      assets: [{ printArea: "default", url: printFileUrl(env, found.product.printFile, origin) }],
    }],
  };

  const { id } = await createProdigiOrder(env, prodigiOrder);
  if (env.PRINT_FILES) {
    await env.PRINT_FILES.put(markerKey, JSON.stringify({ paypalOrder: orderId, prodigiOrder: id, at: new Date().toISOString() }),
      { httpMetadata: { contentType: "application/json" } });
  }
  return `Sent to Prodigi as ${id}`;
}

function printFileUrl(env, printFile, origin) {
  if (printFile.startsWith("r2:")) {
    const site = (env.SITE_URL || origin).replace(/\/$/, "");
    return `${site}/api/print-file/${encodeURIComponent(printFile.slice(3))}?token=${encodeURIComponent(env.PRINT_FILE_TOKEN || "")}`;
  }
  return printFile;
}
