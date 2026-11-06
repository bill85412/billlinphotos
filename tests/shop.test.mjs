// End-to-end tests for the shop functions with fake PayPal, Prodigi and R2.
// Run from a scratch copy:  cp -r functions tests/shop.test.mjs SCRATCH/ && echo '{"type":"module"}' > SCRATCH/package.json
// then  SITE_ROOT=$PWD node SCRATCH/shop.test.mjs   (imports below assume functions/ sits next to this file)
import assert from "node:assert/strict";
import { onRequestPost as checkout } from "./functions/api/checkout.js";
import { onRequestGet as paypalReturn } from "./functions/api/paypal-return.js";
import { onRequestPost as webhook } from "./functions/api/paypal-webhook.js";
import { onRequestGet as printFile } from "./functions/api/print-file/[name].js";

const SB = "https://api-m.sandbox.paypal.com";
function makeBucket() {
  const store = new Map([["transient-serenity.jpg", "JPEGDATA"]]);
  return {
    store,
    get: async (k) => (store.has(k) ? { body: store.get(k), httpMetadata: { contentType: "image/jpeg" } } : null),
    put: async (k, v) => { store.set(k, v); },
  };
}
const bucket = makeBucket();
const env = {
  PAYPAL_CLIENT_ID: "cid", PAYPAL_CLIENT_SECRET: "sec", PAYPAL_WEBHOOK_ID: "WH-1",
  PRODIGI_API_KEY: "sandbox_abc", PRINT_FILE_TOKEN: "tok123", SITE_URL: "https://billlinphotos.com", PRINT_FILES: bucket,
};

let calls = [];
let paypalOrder;           // what GET /v2/checkout/orders/:id returns
let captureReply;          // what the capture call returns
let verifyStatus = "SUCCESS";
let prodigiStatus = 202;
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url, method: init.method, body: init.body, headers: init.headers });
  if (url === `${SB}/v1/oauth2/token`) return reply({ access_token: "AT" });
  if (url === `${SB}/v2/checkout/orders` && init.method === "POST") return reply({ id: "ORD1", links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORD1" }] }, 201);
  if (url.endsWith("/capture")) return reply(...captureReply);
  if (url.startsWith(`${SB}/v2/checkout/orders/`) && init.method === "GET") return reply(paypalOrder);
  if (url === `${SB}/v1/notifications/verify-webhook-signature`) return reply({ verification_status: verifyStatus });
  if (url === "https://api.prodigi.com/v5/orders") {
    return prodigiStatus === 202 ? reply({ data: { id: "ord_777", status: "pending_submission" } }, 202) : reply({ error: "bad sku" }, prodigiStatus);
  }
  throw new Error("unexpected fetch " + url);
};
const post = (url, body, headers = {}) => new Request(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });

// ---- checkout (whole cart) ----
let r = await checkout({ request: post("https://billlinphotos.com/api/checkout", { items: [
  { slug: "transient-serenity", variant: "Canvas / 16 × 24 in", quantity: 2 },
  { slug: "transient-serenity", variant: "Framed Print / 16 × 24 in", quantity: 1 },
  { slug: "transient-serenity", variant: "Canvas / 16 × 24 in", quantity: 1 },
] }), env });
assert.equal(r.status, 200);
assert.equal((await r.json()).url, "https://www.sandbox.paypal.com/checkoutnow?token=ORD1");
const created = JSON.parse(calls.find((c) => c.url === `${SB}/v2/checkout/orders`).body);
const pu = created.purchase_units[0];
assert.equal(created.intent, "CAPTURE");
assert.equal(pu.items.length, 2, "repeated lines are merged");
assert.equal(pu.items[0].sku, "transient-serenity|Canvas / 16 × 24 in");
assert.equal(pu.items[0].name, "“Transient Serenity” — Canvas / 16 × 24 in");
assert.equal(pu.items[0].quantity, "3");
assert.equal(pu.items[0].unit_amount.value, "100.00");
assert.equal(pu.items[1].sku, "transient-serenity|Framed Print / 16 × 24 in");
assert.equal(pu.items[1].unit_amount.value, "80.00");
assert.equal(pu.amount.breakdown.item_total.value, "380.00");
assert.equal(pu.amount.value, "380.00");
assert.equal(created.payment_source.paypal.experience_context.return_url, "https://billlinphotos.com/api/paypal-return");
assert.equal(created.payment_source.paypal.experience_context.cancel_url, "https://billlinphotos.com/cart.html");
assert.equal(created.payment_source.paypal.experience_context.shipping_preference, "GET_FROM_FILE");
console.log("✓ checkout turns the whole cart into one PayPal order, priced from the server catalog");

r = await checkout({ request: post("https://x/api/checkout", { items: [{ slug: "transient-serenity", variant: "Gold Print", quantity: 1 }] }), env });
assert.equal(r.status, 404);
r = await checkout({ request: post("https://x/api/checkout", { items: [{ slug: "transient-serenity", variant: "Canvas / 16 × 24 in", quantity: 50 }] }), env });
assert.equal(r.status, 400);
r = await checkout({ request: post("https://x/api/checkout", { items: [] }), env });
assert.equal(r.status, 400);
r = await checkout({ request: post("https://x/api/checkout", { items: [{ slug: "transient-serenity", variant: "Canvas / 16 × 24 in", quantity: 1 }] }), env: {} });
assert.equal(r.status, 503);
console.log("✓ checkout rejects unknown options, silly quantities, empty carts, and missing PayPal keys");

// ---- return from PayPal ----
captureReply = [{ id: "ORD1", status: "COMPLETED" }, 201];
r = await paypalReturn({ request: new Request("https://billlinphotos.com/api/paypal-return?token=ORD1&PayerID=P1"), env });
assert.equal(r.status, 302);
assert.equal(r.headers.get("Location"), "https://billlinphotos.com/order-success.html");
captureReply = [{ name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] }, 422];
r = await paypalReturn({ request: new Request("https://billlinphotos.com/api/paypal-return?token=ORD1"), env });
assert.equal(r.headers.get("Location"), "https://billlinphotos.com/order-success.html");
captureReply = [{ name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] }, 422];
r = await paypalReturn({ request: new Request("https://billlinphotos.com/api/paypal-return?token=ORD1"), env });
assert.equal(r.headers.get("Location"), "https://billlinphotos.com/cart.html?payment=failed");
console.log("✓ returning from PayPal captures the payment; a declined card goes back to the cart");

// ---- webhook → Prodigi ----
paypalOrder = {
  id: "ORD1", status: "COMPLETED",
  payer: { email_address: "buyer@example.com", name: { given_name: "Ann", surname: "Buyer" }, phone: { phone_number: { national_number: "6175550100" } } },
  purchase_units: [{
    reference_id: "cart",
    items: [
      { name: "Transient Serenity — Framed Print", sku: "transient-serenity|Framed Print / 16 × 24 in", quantity: "1" },
      { name: "Transient Serenity — Canvas", sku: "transient-serenity|Canvas / 16 × 24 in", quantity: "2" },
    ],
    shipping: { name: { full_name: "Ann Buyer" }, address: { address_line_1: "1 Main St", admin_area_2: "Boston", admin_area_1: "MA", postal_code: "02116", country_code: "US" } },
  }],
};
const event = { event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAP1", supplementary_data: { related_ids: { order_id: "ORD1" } } } };
const ppHeaders = { "paypal-transmission-id": "t1", "paypal-transmission-sig": "s", "paypal-transmission-time": "now", "paypal-auth-algo": "SHA256withRSA", "paypal-cert-url": "https://api.paypal.com/cert" };

calls = [];
r = await webhook({ request: post("https://billlinphotos.com/api/paypal-webhook", event, ppHeaders), env });
assert.equal(r.status, 200, await r.clone().text());
const verifyCall = JSON.parse(calls.find((c) => c.url.endsWith("verify-webhook-signature")).body);
assert.equal(verifyCall.webhook_id, "WH-1");
assert.equal(verifyCall.transmission_id, "t1");
const prodigiCall = calls.find((c) => c.url.endsWith("/v5/orders"));
assert.equal(prodigiCall.headers["X-API-Key"], "sandbox_abc");
const order = JSON.parse(prodigiCall.body);
assert.equal(order.submit, true);
assert.equal(order.merchantReference, "ORD1");
assert.equal(order.items.length, 2);
assert.equal(order.items[0].sku, "GLOBAL-CFPM-16X24");
assert.equal(order.items[0].quantity, 1);
assert.equal(order.items[1].sku, "GLOBAL-CAN-16X24");
assert.equal(order.items[1].quantity, 2);
assert.equal(order.items[0].assets[0].url, "https://billlinphotos.com/api/print-file/transient-serenity.jpg?token=tok123");
assert.equal(order.recipient.name, "Ann Buyer");
assert.equal(order.recipient.address.townOrCity, "Boston");
assert.equal(order.recipient.address.countryCode, "US");
assert.equal(order.recipient.email, "buyer@example.com");
assert.equal(order.recipient.phoneNumber, "6175550100");
assert.ok(bucket.store.has("orders/ORD1.json"));
console.log("✓ a captured PayPal payment becomes one Prodigi order with every cart item, the address and print files");

calls = [];
r = await webhook({ request: post("https://billlinphotos.com/api/paypal-webhook", event, ppHeaders), env });
assert.equal(r.status, 200);
assert.match(await r.text(), /Already sent/);
assert.ok(!calls.some((c) => c.url.endsWith("/v5/orders")));
console.log("✓ a repeated PayPal notification does not create a second print order");

verifyStatus = "FAILURE";
r = await webhook({ request: post("https://billlinphotos.com/api/paypal-webhook", event, ppHeaders), env });
assert.equal(r.status, 400);
r = await webhook({ request: post("https://billlinphotos.com/api/paypal-webhook", event, {}), env });
assert.equal(r.status, 400);
verifyStatus = "SUCCESS";
console.log("✓ notifications PayPal does not vouch for are rejected");

bucket.store.delete("orders/ORD1.json"); prodigiStatus = 400; calls = [];
r = await webhook({ request: post("https://billlinphotos.com/api/paypal-webhook", event, ppHeaders), env });
assert.equal(r.status, 500);
assert.match(await r.text(), /Prodigi order failed \(400\)/);
assert.ok(!bucket.store.has("orders/ORD1.json"));
prodigiStatus = 202;
r = await webhook({ request: post("https://billlinphotos.com/api/paypal-webhook", event, ppHeaders), env });
assert.equal(r.status, 200);
assert.ok(bucket.store.has("orders/ORD1.json"));
console.log("✓ a Prodigi error returns 500 so PayPal retries, and the retry goes through");

paypalOrder.status = "APPROVED"; bucket.store.delete("orders/ORD1.json"); calls = [];
r = await webhook({ request: post("https://billlinphotos.com/api/paypal-webhook", event, ppHeaders), env });
assert.equal(r.status, 200);
assert.ok(!calls.some((c) => c.url.endsWith("/v5/orders")));
console.log("✓ orders PayPal has not marked as paid are not printed");

// ---- print file ----
r = await printFile({ params: { name: "transient-serenity.jpg" }, request: new Request("https://x/api/print-file/transient-serenity.jpg?token=tok123"), env });
assert.equal(r.status, 200); assert.equal(await r.text(), "JPEGDATA");
r = await printFile({ params: { name: "transient-serenity.jpg" }, request: new Request("https://x/api/print-file/transient-serenity.jpg?token=nope"), env });
assert.equal(r.status, 404);
console.log("✓ print files are only served with the secret token");

// ---- every product page in the shop has a matching catalog entry ----
import { readFileSync, readdirSync } from "node:fs";
import { PRODUCTS } from "./functions/_lib/catalog.js";
const ROOT = process.env.SITE_ROOT;
if (ROOT) {
  for (const f of readdirSync(ROOT).filter((n) => n.endsWith(".html"))) {
    const html = readFileSync(`${ROOT}/${f}`, "utf8");
    const handle = (html.match(/data-handle="([^"]+)"/) || [])[1];
    if (!handle) continue;
    assert.equal(`${handle}.html`, f, `${f}: data-handle must match the file name`);
    assert.ok(PRODUCTS[handle], `${f}: no catalog entry for ${handle}`);
    // every combination of the page's option buttons must be a catalog variant with the same price
    const groups = [...html.matchAll(/<div class="options"[^>]*>([\s\S]*?)<\/div>/g)].map((g) =>
      [...g[1].matchAll(/data-value="([^"]+)"(?: data-price="([^"]+)")?(?: data-prices='([^']+)')?/g)].map(([, value, price, prices]) => ({ value, price, prices: prices && JSON.parse(prices) })));
    const combos = groups.reduce((acc, g) => acc.flatMap((c) => g.map((v) => [...c, v])), [[]]);
    for (const c of combos) {
      const key = c.map((v) => v.value).join(" / ");
      const v = PRODUCTS[handle].variants[key];
      assert.ok(v, `${f}: option ${key} missing from the catalog`);
      let price = null;
      for (const o of c) {
        if (o.prices) { const other = c.find((x) => x !== o && o.prices[x.value] != null); if (other) { price = o.prices[other.value]; break; } }
        else if (o.price != null) { price = parseFloat(o.price); break; }
      }
      assert.equal(v.price, Math.round(price * 100), `${f}: ${key} price differs from the catalog`);
    }
    assert.equal(combos.length, Object.keys(PRODUCTS[handle].variants).length, `${f}: page and catalog have different option sets`);
  }
  console.log("✓ every product page's options and prices match the server catalog");
}

console.log("\nAll tests passed.");
