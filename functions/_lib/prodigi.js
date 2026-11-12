// Prodigi Print API (v5). One address for test and live orders:
// the API key's prefix decides which — "sandbox_..." for test orders, "live_..." for real ones.

const DEFAULT_BASE = "https://api.prodigi.com/v5";

// The dashboards show the key without its prefix; v5 needs "sandbox_<key>" or "live_<key>".
// A key pasted without a prefix gets one from PRODIGI_ENV ("live" for real orders; anything else = sandbox).
export function prodigiKey(env) {
  const k = String(env.PRODIGI_API_KEY || "").trim();
  if (/^(sandbox|live)_/.test(k)) return k;
  return (String(env.PRODIGI_ENV || "").trim().toLowerCase() === "live" ? "live_" : "sandbox_") + k;
}

export async function createProdigiOrder(env, order) {
  const base = env.PRODIGI_API_BASE || DEFAULT_BASE;
  const res = await fetch(`${base}/orders`, {
    method: "POST",
    headers: { "X-API-Key": prodigiKey(env), "Content-Type": "application/json" },
    body: JSON.stringify(order),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`Prodigi order failed (${res.status}): ${text.slice(0, 500)}`);
  const id = data?.data?.id || data?.order?.id || data?.id || "unknown";
  return { id, data };
}

async function prodigiGet(env, path) {
  const base = env.PRODIGI_API_BASE || DEFAULT_BASE;
  const res = await fetch(`${base}${path}`, { headers: { "X-API-Key": prodigiKey(env) } });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`Prodigi ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  return data;
}

// Order (v5: { data: Order }) — status is draft / pending_submission / submitted / in_production /
// partially_shipped / shipped / completed / cancelled / failed / on_hold / paused.
export async function getProdigiOrder(env, id) {
  const d = await prodigiGet(env, `/orders/${encodeURIComponent(id)}`);
  return d.data || d.order || d;
}

// Shipments (v5: { data: [Shipment] }) — carrier, service, trackingNumber, trackingUrl, status, dispatchedAt, deliveredAt.
export async function getProdigiShipments(env, id) {
  const d = await prodigiGet(env, `/orders/${encodeURIComponent(id)}/shipments`);
  return Array.isArray(d.data) ? d.data : Array.isArray(d.shipments) ? d.shipments : [];
}

// A shipment counts as shipped once it has left the lab or has tracking.
export const isShipped = (s) => ["dispatched", "in_transit", "shipped", "delivered"].includes(String(s.status || "").toLowerCase()) || !!(s.trackingNumber || s.trackingUrl);
