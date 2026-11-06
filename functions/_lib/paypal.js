// Minimal PayPal REST client (Orders v2 + webhook verification) for Cloudflare Pages Functions.
// PAYPAL_ENV = "live" uses real money; anything else uses the PayPal sandbox.

export function paypalBase(env) {
  return env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function accessToken(env) {
  const res = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`PayPal sign-in failed (${res.status})`);
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
