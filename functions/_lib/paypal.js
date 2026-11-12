// Minimal PayPal REST client (Orders v2 + webhook verification) for Cloudflare Pages Functions.
// PAYPAL_ENV = "live" uses real money; anything else uses the PayPal sandbox.

export function paypalBase(env) {
  return String(env.PAYPAL_ENV || "").trim().toLowerCase() === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function accessToken(env) {
  const res = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      // trim: a pasted key often carries a stray space or line break
      Authorization: "Basic " + btoa(`${String(env.PAYPAL_CLIENT_ID).trim()}:${String(env.PAYPAL_CLIENT_SECRET).trim()}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const e = new Error(`PayPal sign-in failed (${res.status}${data.error ? `: ${data.error}` : ""})`);
    e.code = "paypal_sign_in"; throw e;
  }
  return data.access_token;
}

export async function paypal(env, method, path, body, extraHeaders = {}) {
  const token = await accessToken(env);
  const res = await fetch(paypalBase(env) + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

// Ask PayPal whether a webhook notification really came from PayPal.
export async function verifyWebhook(env, request, event) {
  const h = (n) => request.headers.get(n);
  if (!env.PAYPAL_WEBHOOK_ID || !h("paypal-transmission-id")) return false;
  const r = await paypal(env, "POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: h("paypal-auth-algo"),
    cert_url: h("paypal-cert-url"),
    transmission_id: h("paypal-transmission-id"),
    transmission_sig: h("paypal-transmission-sig"),
    transmission_time: h("paypal-transmission-time"),
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: event,
  });
  return r.ok && r.data.verification_status === "SUCCESS";
}

export const money = (cents) => (cents / 100).toFixed(2);
