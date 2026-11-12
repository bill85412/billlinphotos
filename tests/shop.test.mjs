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
  RESEND_API_KEY: "re_test", EMAIL_REPLY_TO: "owner@example.com",
};

let calls = [];
let paypalOrder;           // what GET /v2/checkout/orders/:id returns
let captureReply;          // what the capture call returns
let verifyStatus = "SUCCESS";
let prodigiStatus = 202;
let emails = [];
let prodigiOrderStatus = "in_production";
let prodigiShipments = [];
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url, method: init.method, body: init.body, headers: init.headers });
  if (url === `${SB}/v1/oauth2/token`) return reply({ access_token: "AT" });
  if (url === `${SB}/v2/checkout/orders` && init.method === "POST") return reply({ id: "ORD1", links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORD1" }] }, 201);
  if (url.endsWith("/capture")) return reply(...captureReply);
  if (url.startsWith(`${SB}/v2/checkout/orders/`) && init.method === "GET") return reply(paypalOrder);
  if (url === `${SB}/v1/notifications/verify-webhook-signature`) return reply({ verification_status: verifyStatus });
  if (url === "https://api.resend.com/emails") { emails.push(JSON.parse(init.body)); return reply({ id: "em_1" }); }
  if (url === "https://api.prodigi.com/v5/orders/ord_777") return reply({ data: { id: "ord_777", status: prodigiOrderStatus, merchantReference: "ORD1" } });
  if (url === "https://api.prodigi.com/v5/orders/ord_777/shipments") return reply({ data: prodigiShipments });
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
assert.equal(pu.items[1].unit_amount.value, "300.00");
assert.equal(pu.amount.breakdown.item_total.value, "600.00");
assert.equal(pu.amount.value, "600.00");
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
assert.equal(r.headers.get("Location"), "https://billlinphotos.com/order-success.html?order=ORD1");
captureReply = [{ name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] }, 422];
r = await paypalReturn({ request: new Request("https://billlinphotos.com/api/paypal-return?token=ORD1"), env });
assert.equal(r.headers.get("Location"), "https://billlinphotos.com/order-success.html?order=ORD1");
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
    amount: { currency_code: "USD", value: "500.00" },
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
assert.equal(order.items[0].sizing, "fitPrintArea");
assert.deepEqual(order.items[0].attributes, { color: "black", mountColor: "snow white" });
assert.equal(order.items[0].quantity, 1);
assert.equal(order.items[1].sku, "GLOBAL-SLIMCAN-16X24");
assert.deepEqual(order.items[1].attributes, { wrap: "ImageWrap" });
assert.equal(order.items[1].quantity, 2);
assert.equal(order.items[0].assets[0].url, "https://billlinphotos.com/api/print-file/transient-serenity.jpg?token=tok123");
assert.equal(order.recipient.name, "Ann Buyer");
assert.equal(order.recipient.address.townOrCity, "Boston");
assert.equal(order.recipient.address.countryCode, "US");
assert.equal(order.recipient.email, "buyer@example.com");
assert.equal(order.recipient.phoneNumber, "6175550100");
assert.ok(bucket.store.has("orders/ORD1.json"));
assert.match(order.callbackUrl, /^https:\/\/billlinphotos\.com\/api\/prodigi-callback\?order=ORD1&sig=[0-9a-f]{32}$/);
console.log("✓ a captured PayPal payment becomes one Prodigi order with every cart item, the address and print files");
assert.equal(emails.length, 1);
assert.deepEqual(emails[0].to, ["owner@example.com"], "sandbox: the owner gets the test emails");
assert.equal(emails[0].reply_to, "owner@example.com");
assert.match(emails[0].subject, /Your order ORD1/);
assert.match(emails[0].html, /Transient Serenity/);
assert.match(emails[0].html, /\$500\.00/);
assert.match(emails[0].html, /track\.html\?order=ORD1/);
const rec1 = JSON.parse(bucket.store.get("orders/ORD1.json"));
assert.equal(rec1.email, "buyer@example.com"); assert.equal(rec1.emails.confirmation, true); assert.equal(rec1.total, 50000);
console.log("✓ the customer gets an order confirmation email with the order number, items, total and a tracking link");

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

// ---- Prodigi callback → shipped email ----
import { onRequestPost as prodigiCallback } from "./functions/api/prodigi-callback.js";
import { onRequestGet as orderStatus } from "./functions/api/order-status.js";
paypalOrder.status = "COMPLETED"; bucket.store.delete("orders/ORD1.json"); emails = [];
r = await webhook({ request: post("https://billlinphotos.com/api/paypal-webhook", event, ppHeaders), env });
assert.equal(r.status, 200);
const cbUrl = JSON.parse(calls.filter((c) => c.url.endsWith("/v5/orders")).pop().body).callbackUrl;
emails = [];
r = await prodigiCallback({ request: post(cbUrl.replace(/sig=.*/, "sig=bad"), {}), env });
assert.equal(r.status, 404);
r = await prodigiCallback({ request: post(cbUrl, { type: "x" }), env });   // nothing shipped yet
assert.equal(r.status, 200); assert.equal(emails.length, 0);
prodigiShipments = [{ id: "shp_1", carrier: "FedEx", service: "Ground", trackingNumber: "TRK123", trackingUrl: "https://track.example/TRK123", status: "dispatched", dispatchedAt: "2026-11-16T10:00:00Z" }];
r = await prodigiCallback({ request: post(cbUrl, {}), env });
assert.equal(r.status, 200); assert.equal(emails.length, 1);
assert.match(emails[0].subject, /shipped/); assert.match(emails[0].html, /TRK123/); assert.match(emails[0].html, /track\.example/);
r = await prodigiCallback({ request: post(cbUrl, {}), env });       // same shipment again: no second email
assert.equal(emails.length, 1);
console.log("✓ when Prodigi ships, the customer gets one email with the carrier and tracking link");

// ---- order status page ----
r = await orderStatus({ request: new Request("https://x/api/order-status?order=ORD1&email=BUYER@example.com"), env });
let st = await r.json();
assert.equal(r.status, 200); assert.equal(st.label, "Shipped"); assert.equal(st.step, 3);
assert.equal(st.shipments[0].trackingNumber, "TRK123"); assert.equal(st.items.length, 2);
r = await orderStatus({ request: new Request("https://x/api/order-status?order=ORD1&email=someone@else.com"), env });
assert.equal(r.status, 404);
r = await orderStatus({ request: new Request("https://x/api/order-status?order=NOPE1&email=buyer@example.com"), env });
assert.equal(r.status, 404);
prodigiShipments = [];
r = await orderStatus({ request: new Request("https://x/api/order-status?order=ORD1&email=buyer@example.com"), env });
st = await r.json(); assert.equal(st.label, "In production");
console.log("✓ customers can look an order up with its number and their email (and nobody else's)");

// ---- sandbox mode sends every email to the owner; live mode to the customer ----
import { sendEmail } from "./functions/_lib/email.js";
emails = [];
await sendEmail(env, { to: "fake@personal.example.com", subject: "Hi", html: "x", text: "x" });
assert.deepEqual(emails[0].to, ["owner@example.com"]); assert.match(emails[0].subject, /^\[TEST\]/);
await sendEmail({ ...env, PAYPAL_ENV: "live" }, { to: "buyer@example.com", subject: "Hi", html: "x", text: "x" });
assert.deepEqual(emails[1].to, ["buyer@example.com"]); assert.equal(emails[1].subject, "Hi");
assert.deepEqual(await sendEmail({ ...env, RESEND_API_KEY: "" }, { to: "a@b.c", subject: "s", html: "", text: "" }), { skipped: "no RESEND_API_KEY" });
console.log("✓ in PayPal sandbox mode the emails go to the owner, and without a Resend key nothing is sent");

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
    let offered = 0;
    const combos = groups.reduce((acc, g) => acc.flatMap((c) => g.map((v) => [...c, v])), [[]]);
    for (const c of combos) {
      const key = c.map((v) => v.value).join(" / ");
      const v = PRODUCTS[handle].variants[key];
      let price = null;
      for (const o of c) {
        if (o.prices) { const other = c.find((x) => x !== o && o.prices[x.value] != null); if (other) { price = o.prices[other.value]; break; } }
        else if (o.price != null) { price = parseFloat(o.price); break; }
      }
      if (price == null) { assert.ok(!v, `${f}: ${key} is in the catalog but the page offers it without a price`); continue; }
      assert.ok(v, `${f}: option ${key} missing from the catalog`);
      assert.equal(v.price, Math.round(price * 100), `${f}: ${key} price differs from the catalog`);
      offered++;
    }
    assert.equal(offered, Object.keys(PRODUCTS[handle].variants).length, `${f}: page and catalog have different option sets`);
  }
  console.log("✓ every product page's options and prices match the server catalog");
}

// ---- Prodigi key prefix ----
import { prodigiKey } from "./functions/_lib/prodigi.js";
assert.equal(prodigiKey({ PRODIGI_API_KEY: " abc-123 " }), "sandbox_abc-123");
assert.equal(prodigiKey({ PRODIGI_API_KEY: "abc", PRODIGI_ENV: "live" }), "live_abc");
assert.equal(prodigiKey({ PRODIGI_API_KEY: "sandbox_abc", PRODIGI_ENV: "live" }), "sandbox_abc");
console.log("✓ the Prodigi key gets its sandbox_/live_ prefix");

console.log("\nAll tests passed.");
