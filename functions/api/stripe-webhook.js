// POST /api/stripe-webhook — Stripe calls this after a customer pays.
// It sends the order to Prodigi, then records the Prodigi order id on the Stripe payment,
// so a repeated notification from Stripe never creates a second print order.
import { stripe, verifyStripeSignature } from "../_lib/stripe.js";
import { createProdigiOrder } from "../_lib/prodigi.js";
import { findVariant, PRODIGI_SHIPPING_METHOD } from "../_lib/catalog.js";

const ok = (msg) => new Response(msg, { status: 200 });

export async function onRequestPost({ request, env }) {
  const payload = await request.text();
  const valid = await verifyStripeSignature(payload, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  const event = JSON.parse(payload);
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return ok("Ignored");
  }
  const session = event.data.object;
  if (session.payment_status !== "paid") return ok("Not paid yet");

  try {
    const result = await fulfil(env, session, new URL(request.url).origin);
    return ok(result);
  } catch (err) {
    // A non-2xx answer makes Stripe retry the notification later (for up to 3 days).
    console.error(err);
    return new Response(String(err.message || err), { status: 500 });
  }
}

export async function fulfil(env, session, origin) {
  const piId = session.payment_intent;
  const pi = piId ? await stripe(env, "GET", `/payment_intents/${piId}`) : null;
  if (pi?.metadata?.prodigi_order_id) return `Already sent to Prodigi as ${pi.metadata.prodigi_order_id}`;

  const { slug, variant, quantity } = session.metadata || {};
  const found = findVariant(slug, variant);
  if (!found) throw new Error(`Unknown product in paid order ${session.id}: ${slug} / ${variant}`);

  const shipping = session.collected_information?.shipping_details || session.shipping_details;
  if (!shipping?.address) throw new Error(`No shipping address on paid order ${session.id}`);
  const a = shipping.address;
  const customer = session.customer_details || {};

  const order = {
    submit: true,
    merchantReference: session.id,
    shippingMethod: PRODIGI_SHIPPING_METHOD,
    recipient: {
      name: shipping.name || customer.name,
      email: customer.email || undefined,
      phoneNumber: customer.phone || undefined,
      address: {
        line1: a.line1,
        line2: a.line2 || undefined,
        postalOrZipCode: a.postal_code,
        countryCode: a.country,
        townOrCity: a.city,
        stateOrCounty: a.state || undefined,
      },
    },
    items: [{
      merchantReference: `${slug}:${variant}`,
      sku: found.variant.sku,
      quantity: Number(quantity) || 1,
      sizing: "fillPrintArea",
      assets: [{ printArea: "default", url: printFileUrl(env, found.product.printFile, origin) }],
    }],
  };

  const { id } = await createProdigiOrder(env, order);
  if (piId) await stripe(env, "POST", `/payment_intents/${piId}`, { metadata: { prodigi_order_id: id } });
  return `Sent to Prodigi as ${id}`;
}

function printFileUrl(env, printFile, origin) {
  if (printFile.startsWith("r2:")) {
    const site = (env.SITE_URL || origin).replace(/\/$/, "");
    return `${site}/api/print-file/${encodeURIComponent(printFile.slice(3))}?token=${encodeURIComponent(env.PRINT_FILE_TOKEN || "")}`;
  }
  return printFile;
}
