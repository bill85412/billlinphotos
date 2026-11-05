// End-to-end tests for the shop functions with fake Stripe and Prodigi APIs.
import assert from "node:assert/strict";
import { onRequestPost as checkout } from "../functions/api/checkout.js";
import { onRequestPost as webhook } from "../functions/api/stripe-webhook.js";
import { onRequestGet as printFile } from "../functions/api/print-file/[name].js";

const env = {
  STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_test",
  PRODIGI_API_KEY: "sandbox_abc", PRINT_FILE_TOKEN: "tok123", SITE_URL: "https://billlinphoto.com",
};
let calls = [];
let piMeta = {};
let prodigiStatus = 202;
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url, method: init.method, body: init.body, headers: init.headers });
  if (url === "https://api.stripe.com/v1/checkout/sessions") return Response.json({ id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" });
  if (url.startsWith("https://api.stripe.com/v1/payment_intents/") && init.method === "GET") return Response.json({ id: "pi_1", metadata: piMeta });
  if (url.startsWith("https://api.stripe.com/v1/payment_intents/") && init.method === "POST") {
    const p = new URLSearchParams(init.body); piMeta = { prodigi_order_id: p.get("metadata[prodigi_order_id]") }; return Response.json({ id: "pi_1" });
  }
  if (url === "https://api.prodigi.com/v5/orders") {
    return prodigiStatus === 202 ? new Response(JSON.stringify({ data: { id: "ord_777", status: "pending_submission" } }), { status: 202 })
      : new Response(JSON.stringify({ error: "bad sku" }), { status: prodigiStatus });
  }
  throw new Error("unexpected fetch " + url);
};

const post = (url, body, headers = {}) => new Request(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });

// ---- checkout ----
let r = await checkout({ request: post("https://billlinphoto.com/api/checkout", { slug: "transient-serenity", variant: "Canvas Print", quantity: 2 }), env });
assert.equal(r.status, 200);
assert.equal((await r.json()).url, "https://checkout.stripe.com/c/cs_1");
const form = new URLSearchParams(calls[0].body);
assert.equal(form.get("line_items[0][price_data][unit_amount]"), "10000");
assert.equal(form.get("line_items[0][quantity]"), "2");
assert.equal(form.get("metadata[variant]"), "Canvas Print");
assert.equal(form.get("payment_intent_data[metadata][slug]"), "transient-serenity");
assert.equal(form.get("success_url"), "https://billlinphoto.com/order-success.html?session_id={CHECKOUT_SESSION_ID}");
assert.equal(form.get("cancel_url"), "https://billlinphoto.com/transient-serenity.html");
assert.equal(form.get("shipping_address_collection[allowed_countries][0]"), "US");
assert.equal(calls[0].headers.Authorization, "Bearer sk_test_x");
console.log("✓ checkout builds the Stripe session from server-side prices");

r = await checkout({ request: post("https://x/api/checkout", { slug: "transient-serenity", variant: "Gold Print", quantity: 1 }), env });
assert.equal(r.status, 404);
r = await checkout({ request: post("https://x/api/checkout", { slug: "transient-serenity", variant: "Canvas Print", quantity: 99 }), env });
assert.equal(r.status, 400);
r = await checkout({ request: post("https://x/api/checkout", { slug: "transient-serenity", variant: "Canvas Print" }), env: {} });
assert.equal(r.status, 503);
console.log("✓ checkout rejects unknown options, silly quantities, and a missing Stripe key");

// ---- webhook ----
async function signed(event, secret = env.STRIPE_WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000)) {
  const payload = JSON.stringify(event);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const sig = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return post("https://billlinphoto.com/api/stripe-webhook", payload, { "Stripe-Signature": `t=${t},v1=${sig}` });
}
const event = {
  type: "checkout.session.completed",
  data: { object: {
    id: "cs_1", payment_status: "paid", payment_intent: "pi_1",
    metadata: { slug: "transient-serenity", variant: "Framed Print", quantity: "1" },
    customer_details: { email: "buyer@example.com", name: "Ann Buyer", phone: "+15551234567" },
    collected_information: { shipping_details: { name: "Ann Buyer", address: { line1: "1 Main St", line2: null, city: "Boston", state: "MA", postal_code: "02116", country: "US" } } },
  } },
};

calls = []; piMeta = {};
r = await webhook({ request: await signed(event), env });
assert.equal(r.status, 200, await r.clone().text());
const prodigiCall = calls.find((c) => c.url.endsWith("/v5/orders"));
assert.ok(prodigiCall, "Prodigi was called");
assert.equal(prodigiCall.headers["X-API-Key"], "sandbox_abc");
const order = JSON.parse(prodigiCall.body);
assert.equal(order.submit, true);
assert.equal(order.items[0].sku, "GLOBAL-CFPM-16X24");
assert.equal(order.items[0].quantity, 1);
assert.equal(order.items[0].assets[0].url, "https://billlinphoto.com/api/print-file/transient-serenity.jpg?token=tok123");
assert.equal(order.recipient.address.townOrCity, "Boston");
assert.equal(order.recipient.address.countryCode, "US");
assert.equal(order.recipient.email, "buyer@example.com");
assert.equal(piMeta.prodigi_order_id, "ord_777");
console.log("✓ a paid checkout becomes a Prodigi order with the right SKU, address and print file");

calls = [];
r = await webhook({ request: await signed(event), env });
assert.equal(r.status, 200);
assert.match(await r.text(), /Already sent/);
assert.ok(!calls.some((c) => c.url.endsWith("/v5/orders")), "no second Prodigi order");
console.log("✓ a repeated Stripe notification does not create a second print order");

r = await webhook({ request: await signed(event, "whsec_wrong"), env });
assert.equal(r.status, 400);
r = await webhook({ request: await signed(event, env.STRIPE_WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 3600), env });
assert.equal(r.status, 400);
console.log("✓ forged or stale notifications are rejected");

const legacy = structuredClone(event);
delete legacy.data.object.collected_information;
legacy.data.object.shipping_details = event.data.object.collected_information.shipping_details;
calls = []; piMeta = {}; prodigiStatus = 400;
r = await webhook({ request: await signed(legacy), env });
assert.equal(r.status, 500);
assert.match(await r.text(), /Prodigi order failed \(400\)/);
assert.equal(piMeta.prodigi_order_id, undefined);
console.log("✓ a Prodigi error returns 500 so Stripe retries, and nothing is marked as sent");

prodigiStatus = 202;
r = await webhook({ request: await signed(legacy), env });
assert.equal(r.status, 200);
console.log("✓ the retry succeeds (older Stripe shipping_details format also works)");

const unpaid = structuredClone(event); unpaid.data.object.payment_status = "unpaid"; calls = [];
r = await webhook({ request: await signed(unpaid), env });
assert.equal(r.status, 200);
assert.equal(calls.length, 0);
console.log("✓ unpaid sessions are ignored");

// ---- print file ----
const bucket = { get: async (k) => (k === "transient-serenity.jpg" ? { body: "JPEGDATA", httpMetadata: { contentType: "image/jpeg" } } : null) };
r = await printFile({ params: { name: "transient-serenity.jpg" }, request: new Request("https://x/api/print-file/transient-serenity.jpg?token=tok123"), env: { ...env, PRINT_FILES: bucket } });
assert.equal(r.status, 200); assert.equal(await r.text(), "JPEGDATA");
r = await printFile({ params: { name: "transient-serenity.jpg" }, request: new Request("https://x/api/print-file/transient-serenity.jpg?token=nope"), env: { ...env, PRINT_FILES: bucket } });
assert.equal(r.status, 404);
console.log("✓ print files are only served with the secret token");

console.log("\nAll tests passed.");
