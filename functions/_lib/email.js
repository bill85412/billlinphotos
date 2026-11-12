// Order emails, sent through Resend (https://resend.com).
// Settings (Cloudflare Pages → Settings → Variables and Secrets):
//   RESEND_API_KEY   secret key from Resend (without it no email is sent, nothing else breaks)
//   EMAIL_FROM       e.g. "Bill Lin Photography <orders@billlinphotos.com>" (the domain must be verified in Resend)
//   EMAIL_REPLY_TO   where customer replies go (the owner's own address)
// While PayPal is in sandbox mode the buyers are fake accounts, so every email goes to EMAIL_REPLY_TO instead.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) return { skipped: "no RESEND_API_KEY" };
  const live = String(env.PAYPAL_ENV || "").trim().toLowerCase() === "live";
  const replyTo = String(env.EMAIL_REPLY_TO || "").trim();
  const dest = live ? to : replyTo || to;
  if (!dest) return { skipped: "no recipient" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${String(env.RESEND_API_KEY).trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM || "Bill Lin Photography <orders@billlinphotos.com>",
      to: [dest],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: live ? subject : `[TEST] ${subject}`,
      html, text,
    }),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return { sent: dest };
}

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

function layout(site, title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f3f3f1;font-family:Georgia,'Times New Roman',serif;color:#222">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f1;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;padding:36px 32px">
<tr><td style="font-size:26px;letter-spacing:.04em;padding-bottom:6px">Bill Lin</td></tr>
<tr><td style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#888;padding-bottom:26px">Photography</td></tr>
<tr><td style="font-size:22px;padding-bottom:16px">${esc(title)}</td></tr>
<tr><td style="font-size:16px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="font-size:13px;color:#888;padding-top:30px;border-top:1px solid #eee;margin-top:24px">
<a href="${esc(site)}" style="color:#888">billlinphotos.com</a></td></tr>
</table></td></tr></table></body></html>`;
}

function itemsTable(items) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border-top:1px solid #eee">
${items.map((i) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">${esc(i.title)}<br><span style="color:#777;font-size:14px">${esc(i.option)} · Qty ${i.quantity}</span></td>
<td align="right" style="padding:10px 0;border-bottom:1px solid #eee;white-space:nowrap">${money(i.price * i.quantity)}</td></tr>`).join("")}
</table>`;
}

const btn = (href, label) => `<p style="margin:26px 0"><a href="${esc(href)}" style="background:#111;color:#fff;text-decoration:none;padding:12px 26px;border-radius:999px;display:inline-block">${esc(label)}</a></p>`;

// rec = the order record kept in R2 (see paypal-webhook.js)
export function confirmationEmail(site, rec) {
  const track = `${site}/track.html?order=${encodeURIComponent(rec.paypalOrder)}`;
  const first = (rec.name || "").split(" ")[0];
  const html = layout(site, "Thank you for your order", `
<p>${first ? `Hi ${esc(first)},` : "Hi,"}</p>
<p>Thank you for your order. Your print is now being made to order and will ship straight from the print lab. I'll email you again with a tracking link as soon as it ships.</p>
<p style="margin:0"><strong>Order number:</strong> ${esc(rec.paypalOrder)}</p>
${itemsTable(rec.items)}
<p style="margin:0">Shipping: ${rec.shipping ? money(rec.shipping) : "Free"}<br><strong>Total: ${money(rec.total)}</strong></p>
<p style="margin-top:18px;color:#555">Ships to:<br>${rec.address.map(esc).join("<br>")}</p>
${btn(track, "Track your order")}
<p style="color:#555;font-size:14px">Need to cancel or change the address? Reply within 2 hours of ordering. See <a href="${esc(site)}/returns.html" style="color:#555">Return Policy</a>.</p>
<p style="color:#555">Thank you for supporting my work.<br>Bill</p>`);
  const text = `Thank you for your order.\n\nOrder number: ${rec.paypalOrder}\n\n${rec.items.map((i) => `${i.title} — ${i.option} × ${i.quantity}  ${money(i.price * i.quantity)}`).join("\n")}\nTotal: ${money(rec.total)}\n\nShips to:\n${rec.address.join("\n")}\n\nTrack your order: ${track}\nNeed to cancel or change the address? Reply within 2 hours of ordering. Return Policy: ${site}/returns.html\n\nBill Lin Photography`;
  return { subject: `Your order ${rec.paypalOrder} — Bill Lin Photography`, html, text };
}

export function shippedEmail(site, rec, s) {
  const track = `${site}/track.html?order=${encodeURIComponent(rec.paypalOrder)}`;
  const first = (rec.name || "").split(" ")[0];
  const carrier = [s.carrier, s.service].filter(Boolean).join(" · ");
  const html = layout(site, "Your print is on its way", `
<p>${first ? `Hi ${esc(first)},` : "Hi,"}</p>
<p>Good news: your order <strong>${esc(rec.paypalOrder)}</strong> has shipped.</p>
${carrier ? `<p style="margin:0">Carrier: ${esc(carrier)}</p>` : ""}
${s.trackingNumber ? `<p style="margin:0">Tracking number: ${esc(s.trackingNumber)}</p>` : ""}
${s.trackingUrl ? btn(s.trackingUrl, "Track your parcel") : btn(track, "Track your order")}
<p style="color:#555">You can also check your order any time at <a href="${esc(track)}" style="color:#555">billlinphotos.com/track</a>.</p>
<p style="color:#555">I hope you enjoy it.<br>Bill</p>`);
  const text = `Your order ${rec.paypalOrder} has shipped.\n${carrier ? `Carrier: ${carrier}\n` : ""}${s.trackingNumber ? `Tracking number: ${s.trackingNumber}\n` : ""}${s.trackingUrl ? `Track your parcel: ${s.trackingUrl}\n` : ""}\nOrder status: ${track}\n\nBill Lin Photography`;
  return { subject: `Your order has shipped — Bill Lin Photography`, html, text };
}
