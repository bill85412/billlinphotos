// GET /api/order-status?order=PAYPAL_ORDER_ID&email=… — the customer's order page (track.html).
// The email must match the order's, so order numbers alone reveal nothing.
import { getProdigiOrder, getProdigiShipments, isShipped } from "../_lib/prodigi.js";
import { loadRecord } from "./paypal-webhook.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const NOT_FOUND = "We couldn't find an order with that number and email. Orders appear here a few minutes after payment.";

// Prodigi order status → the four steps shown to the customer
function stepOf(status, shipments) {
  const s = String(status || "").toLowerCase();
  if (s === "cancelled" || s === "failed") return { step: 0, label: "Cancelled" };
  if (shipments.some((x) => String(x.status).toLowerCase() === "delivered")) return { step: 4, label: "Delivered" };
  if (shipments.some(isShipped) || s === "shipped" || s === "partially_shipped" || s === "completed") return { step: 3, label: "Shipped" };
  if (s === "in_production") return { step: 2, label: "In production" };
  return { step: 1, label: "Order received" };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const order = (url.searchParams.get("order") || "").trim();
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  if (!order || !email) return json({ error: "Please enter your order number and email." }, 400);
  const rec = await loadRecord(env, order);
  if (!rec || String(rec.email || "").toLowerCase() !== email) return json({ error: NOT_FOUND }, 404);

  let status = "submitted", shipments = [];
  try {
    const [o, sh] = await Promise.all([getProdigiOrder(env, rec.prodigiOrder), getProdigiShipments(env, rec.prodigiOrder)]);
    status = o.status || status; shipments = sh;
  } catch (err) { console.error(err); }

  return json({
    order: rec.paypalOrder,
    placedAt: rec.at,
    items: rec.items,
    total: rec.total,
    ...stepOf(status, shipments),
    shipments: shipments.filter(isShipped).map((s) => ({
      carrier: s.carrier || "", service: s.service || "", trackingNumber: s.trackingNumber || "", trackingUrl: s.trackingUrl || "",
      status: s.status || "", dispatchedAt: s.dispatchedAt || "", deliveredAt: s.deliveredAt || "",
    })),
  });
}
