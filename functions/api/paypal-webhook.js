// POST /api/paypal-webhook — PayPal calls this when a payment is captured.
// It checks with PayPal that the notification is genuine, reads the order from PayPal itself,
// sends it to Prodigi, and leaves a marker in R2 so the same payment is never printed twice.
import { paypal, verifyWebhook } from "../_lib/paypal.js";
import { createProdigiOrder } from "../_lib/prodigi.js";
import { findVariant, PRODIGI_SHIPPING_METHOD, SHIPPING } from "../_lib/catalog.js";
import { sendEmail, confirmationEmail } from "../_lib/email.js";
import { sign } from "../_lib/sign.js";

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
  // Each PayPal line item's sku is "slug|variant" (set by /api/checkout).
  const lines = (unit.items || []).map((it) => {
    const [slug, variant] = String(it.sku || "").split("|");
    return { slug, variant, quantity: Number(it.quantity) || 1, found: findVariant(slug, variant) };
  });
  if (!lines.length) throw new Error(`No items on paid PayPal order ${orderId}`);
  const unknown = lines.find((l) => !l.found);
  if (unknown) throw new Error(`Unknown product in paid PayPal order ${orderId}: ${unknown.slug} / ${unknown.variant}`);

  const ship = unit.shipping;
  const a = ship?.address;
  if (!a?.address_line_1) throw new Error(`No shipping address on paid PayPal order ${orderId}`);
  const payer = order.payer || {};

  const site = (env.SITE_URL || origin).replace(/\/$/, "");
  const prodigiOrder = {
    submit: true,
    merchantReference: orderId,
    // Prodigi calls this when the order moves on (e.g. ships); it then emails the tracking link.
    callbackUrl: `${site}/api/prodigi-callback?order=${encodeURIComponent(orderId)}&sig=${await sign(env, orderId)}`,
    shippingMethod: PRODIGI_SHIPPING_METHOD,
    recipient: {
      name: ship.name?.full_name || [payer.name?.given_name, payer.name?.surname].filter(Boolean).join(" "),
      email: payer.email_address || undefined,
      // The courier uses this for delivery questions; PayPal includes it when the buyer gives one.
      phoneNumber: phoneOf(ship.phone_number) || phoneOf(payer.phone?.phone_number) || undefined,
      address: {
        line1: a.address_line_1,
        line2: a.address_line_2 || undefined,
        postalOrZipCode: a.postal_code,
        countryCode: a.country_code,
        townOrCity: a.admin_area_2,
        stateOrCounty: a.admin_area_1 || undefined,
      },
    },
    items: lines.map((l) => ({
      merchantReference: `${l.slug}:${l.variant}`,
      sku: l.found.variant.sku,
      quantity: l.quantity,
      sizing: l.found.variant.sizing || "fillPrintArea",
      ...(l.found.variant.attributes ? { attributes: l.found.variant.attributes } : {}),
      assets: [{ printArea: "default", url: printFileUrl(env, l.found.product.printFile, origin) }],
    })),
  };

  const { id } = await createProdigiOrder(env, prodigiOrder);

  // The order record: lets the customer look the order up (/api/order-status) and drives the emails.
  const r2 = prodigiOrder.recipient;
  const record = {
    paypalOrder: orderId, prodigiOrder: id, at: new Date().toISOString(),
    email: r2.email || "", name: r2.name || "",
    address: [r2.name, a.address_line_1, a.address_line_2, [a.admin_area_2, a.admin_area_1, a.postal_code].filter(Boolean).join(" "), a.country_code].filter(Boolean),
    items: lines.map((l) => ({ title: l.found.product.title, option: l.variant, quantity: l.quantity, price: l.found.variant.price })),
    shipping: SHIPPING.amount,
    total: Math.round(Number(unit.amount?.value || 0) * 100),
    emails: { confirmation: false, shipped: [] },
  };
  try {
    if (record.email) {
      const m = await sendEmail(env, { to: record.email, ...confirmationEmail(site, record) });
      record.emails.confirmation = !!m.sent;
    }
  } catch (err) { console.error(err); } // an email problem must never stop the print order
  if (env.PRINT_FILES) await saveRecord(env, record);
  return `Sent to Prodigi as ${id}`;
}

function printFileUrl(env, printFile, origin) {
  if (printFile.startsWith("r2:")) {
    const site = (env.SITE_URL || origin).replace(/\/$/, "");
    return `${site}/api/print-file/${encodeURIComponent(printFile.slice(3))}?token=${encodeURIComponent(env.PRINT_FILE_TOKEN || "")}`;
  }
  return printFile;
}

// PayPal phone objects: { country_code: "1", national_number: "6175550100" } (country code not always present).
function phoneOf(p) {
  if (!p?.national_number) return "";
  return (p.country_code ? `+${p.country_code} ` : "") + p.national_number;
}

export async function saveRecord(env, record) {
  await env.PRINT_FILES.put(`orders/${record.paypalOrder}.json`, JSON.stringify(record), { httpMetadata: { contentType: "application/json" } });
}
export async function loadRecord(env, paypalOrder) {
  if (!env.PRINT_FILES || !/^[A-Za-z0-9-]{3,64}$/.test(paypalOrder || "")) return null;
  const obj = await env.PRINT_FILES.get(`orders/${paypalOrder}.json`);
  if (!obj) return null;
  try { return JSON.parse(typeof obj.text === "function" ? await obj.text() : obj.body); } catch { return null; }
}
