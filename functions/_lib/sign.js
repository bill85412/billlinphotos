// Small HMAC helper: signs values (e.g. the PayPal order id in Prodigi's callback address) with PRINT_FILE_TOKEN,
// so only addresses this site made are accepted.
export async function sign(env, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(env.PRINT_FILE_TOKEN || "")),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(value)));
  return [...new Uint8Array(mac)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function verify(env, value, sig) {
  if (!env.PRINT_FILE_TOKEN || !sig) return false;
  return (await sign(env, value)) === sig;
}
