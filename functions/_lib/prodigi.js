// Prodigi Print API (v5). One address for test and live orders:
// the API key's prefix decides which — "sandbox_..." for test orders, "live_..." for real ones.

const DEFAULT_BASE = "https://api.prodigi.com/v5";

export async function createProdigiOrder(env, order) {
  const base = env.PRODIGI_API_BASE || DEFAULT_BASE;
  const res = await fetch(`${base}/orders`, {
    method: "POST",
    headers: { "X-API-Key": env.PRODIGI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(order),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`Prodigi order failed (${res.status}): ${text.slice(0, 500)}`);
  const id = data?.data?.id || data?.order?.id || data?.id || "unknown";
  return { id, data };
}
