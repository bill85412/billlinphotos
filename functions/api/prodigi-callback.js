// POST /api/prodigi-callback?order=PAYPAL_ORDER_ID&sig=… — Prodigi calls this (the order's callbackUrl) whenever
// the order changes. The body is not trusted: the signed address names the order, and the shipment details are
// read back from Prodigi itself. Each newly shipped parcel gets one "your order has shipped" email.
import { verify } from "../_lib/sign.js";
import { getProdigiShipments, isShipped } from "../_lib/prodigi.js";
import { sendEmail, shippedEmail } from "../_lib/email.js";
import { loadRecord, saveRecord } from "./paypal-webhook.js";

const text = (msg, status = 200) => new Response(msg, { status });

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const order = url.searchParams.get("order");
  if (!(await verify(env, order, url.searchParams.get("sig")))) return text("Not found", 404);
  const rec = await loadRecord(env, order);
  if (!rec) return text("Unknown order", 404);
  try {
    return text(await notifyShipments(env, rec, (env.SITE_URL || url.origin).replace(/\/$/, "")));
  } catch (err) {
    console.error(err);
    return text(String(err.message || err), 500); // Prodigi retries
  }
}

export async function notifyShipments(env, rec, site) {
  const shipments = (await getProdigiShipments(env, rec.prodigiOrder)).filter(isShipped);
  rec.emails = rec.emails || { confirmation: false, shipped: [] };
  const sent = new Set(rec.emails.shipped || []);
  let n = 0;
  for (const s of shipments) {
    const key = String(s.id || s.trackingNumber || n);
    if (sent.has(key) || !rec.email) continue;
    const m = await sendEmail(env, { to: rec.email, ...shippedEmail(site, rec, s) });
    if (m.sent) { sent.add(key); n++; }
  }
  rec.emails.shipped = [...sent];
  await saveRecord(env, rec);
  return `${n} shipping email(s) sent`;
}
