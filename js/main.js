(function () {
  const page = document.body.dataset.page || "";
  const cfg = window.SITE_CONFIG || {};

  /* ---------- Shop: the cart lives in Shopify (Storefront API), the way skypathstudio.com does it ---------- */
  const SHOP = cfg.shopify || {};
  const SHOP_READY = !!(SHOP.domain && SHOP.token);
  const API_VERSION = "2025-07";
  const CART_ID_KEY = "billlin-shopify-cart";
  const COUNT_KEY = "billlin-cart-count";
  const MAX_QTY = 10;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
  };
  function updateCartBadge(n = +store.get(COUNT_KEY) || 0) {
    document.querySelectorAll(".cart-count").forEach((el) => { el.textContent = n; el.hidden = !n; });
  }
  window.addEventListener("storage", (e) => { if (e.key === COUNT_KEY) updateCartBadge(); });

  /* ---------- Header & footer (shared across pages) ---------- */
  const nav = [
    ["about.html", "About", "about"],
    ["gallery.html", "Gallery", "gallery"],
    ["blog.html", "Blog", "blog"],
    ["shop.html", "Shop", "shop"],
  ];
  const links = nav.map(([h, t, k]) => `<a href="${h}"${k === page ? ' class="active"' : ""}>${t}</a>`).join("");
  const ig = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none"/></svg>`;
  const yt = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" stroke="none"/></svg>`;
  const IG_URL = "https://www.instagram.com/billlinphotos/";
  const YT_URL = "https://www.youtube.com/@billlin914";
  const cart = `<svg viewBox="0 0 30 22" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 1.5h4.2l4 14h15.6l3.6-10.5H7.4"/><circle cx="11.5" cy="19.6" r="1.3"/><circle cx="23" cy="19.6" r="1.3"/></svg>`;

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <a class="site-title" href="index.html">Bill Lin</a>
    <nav class="site-nav" aria-label="Main">${links}</nav>
    <div class="header-icons">
      <a href="${IG_URL}" target="_blank" rel="noopener" aria-label="Instagram">${ig}</a>
      <a href="${YT_URL}" target="_blank" rel="noopener" aria-label="YouTube">${yt}</a>
      <a class="cart" href="cart.html" aria-label="Cart">${cart}<span class="cart-count" hidden></span></a>
    </div>
    <div class="header-mobile">
      <a class="cart" href="cart.html" aria-label="Cart">${cart}<span class="cart-count" hidden></span></a>
      <button class="menu-toggle" aria-label="Open menu"><span></span><span></span></button>
    </div>`;
  document.body.prepend(header);
  updateCartBadge();

  const mm = document.createElement("div");
  mm.className = "mobile-menu";
  mm.innerHTML = `<button class="close" aria-label="Close menu">×</button>${links}
    <div class="mm-social">
      <a href="${IG_URL}" target="_blank" rel="noopener" aria-label="Instagram">${ig}</a>
      <a href="${YT_URL}" target="_blank" rel="noopener" aria-label="YouTube">${yt}</a>
    </div>`;
  document.body.append(mm);
  header.querySelector(".menu-toggle").onclick = () => mm.classList.add("open");
  mm.querySelector(".close").onclick = () => mm.classList.remove("open");

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<p>Copyright © ${new Date().getFullYear()} by Bill Lin</p>`;
  // The copyright sits at the bottom of the page's last section (over its photo or colour), not in a band of its own.
  const lastSection = document.querySelector("main") && document.querySelector("main").lastElementChild;
  if (lastSection) {
    lastSection.classList.add("has-footer");
    lastSection.append(footer);
    const fitFooter = () => {
      lastSection.style.paddingBottom = "";
      const pad = parseFloat(getComputedStyle(lastSection).paddingBottom) || 0;
      const need = footer.offsetHeight + 12;
      if (pad < need) lastSection.style.paddingBottom = `${pad + footer.offsetHeight}px`;
    };
    fitFooter();
    window.addEventListener("resize", fitFooter);
  } else document.body.append(footer);

  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Masonry (shortest-column, like Squarespace) ---------- */
  function layoutMasonry(el) {
    const items = el._items || (el._items = [...el.querySelectorAll("figure")]);
    const w = window.innerWidth;
    const base = +el.dataset.cols || 3;
    const cols = w < 560 ? 1 : w < 900 ? 2 : base;
    if (el._cols === cols && el._done) return;
    el.innerHTML = "";
    const colEls = [], heights = [];
    for (let i = 0; i < cols; i++) {
      const c = document.createElement("div");
      c.className = "col";
      el.append(c); colEls.push(c); heights.push(0);
    }
    items.forEach((fig) => {
      const img = fig.querySelector("img");
      const ratio = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
      let k = 0;
      for (let i = 1; i < cols; i++) if (heights[i] < heights[k] - 0.01) k = i;
      colEls[k].append(fig);
      heights[k] += ratio + 0.02;
    });
    el._cols = cols;
    el._done = items.every((f) => f.querySelector("img").complete);
  }
  document.querySelectorAll(".masonry").forEach((el) => {
    const imgs = [...el.querySelectorAll("img")];
    let t;
    const relayout = () => { clearTimeout(t); t = setTimeout(() => { el._done = false; layoutMasonry(el); }, 80); };
    layoutMasonry(el);
    imgs.forEach((i) => {
      if (!i.complete) {
        i.addEventListener("load", relayout, { once: true });
        i.addEventListener("error", relayout, { once: true });
      }
    });
    window.addEventListener("resize", () => { el._done = false; layoutMasonry(el); });
  });

  /* ---------- Lightbox ("View fullsize") ---------- */
  const zoomables = [...document.querySelectorAll("figure.zoom")];
  if (zoomables.length) {
    const lb = document.createElement("div");
    lb.className = "lightbox";
    lb.innerHTML = `<button class="lb-close" aria-label="Close">×</button>
      <button class="lb-prev" aria-label="Previous">‹</button><img alt=""><button class="lb-next" aria-label="Next">›</button>`;
    document.body.append(lb);
    const lbImg = lb.querySelector("img");
    let group = [], idx = 0;
    // Show the 2560px page image at once, then swap in the 4000px version when it has loaded.
    let pending = 0;
    const show = () => {
      const img = group[idx].querySelector("img");
      const token = ++pending;
      lbImg.src = img.getAttribute("src");
      lbImg.alt = img.alt;
      const full = img.dataset.full;
      if (full) {
        const hi = new Image();
        hi.onload = () => { if (token === pending) lbImg.src = full; };
        hi.src = full;
      }
    };
    zoomables.forEach((f) => f.addEventListener("click", () => {
      const scope = f.closest("[data-group]") || document;
      group = [...scope.querySelectorAll("figure.zoom")];
      idx = group.indexOf(f); show(); lb.classList.add("open");
    }));
    const close = () => lb.classList.remove("open");
    lb.querySelector(".lb-close").onclick = close;
    lb.querySelector(".lb-prev").onclick = (e) => { e.stopPropagation(); idx = (idx - 1 + group.length) % group.length; show(); };
    lb.querySelector(".lb-next").onclick = (e) => { e.stopPropagation(); idx = (idx + 1) % group.length; show(); };
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") lb.querySelector(".lb-prev").click();
      if (e.key === "ArrowRight") lb.querySelector(".lb-next").click();
    });
  }

  /* ---------- World map: lay out each callout label at the end of its leader line ---------- */
  // The label font grows on narrower windows (CSS), so positions and box size are measured here.
  function layoutCallouts() {
    document.querySelectorAll(".world-map .callout").forEach((g) => {
      const m = g.querySelector(".leader").getAttribute("d").match(/L([\d.]+) ([\d.]+)H([\d.]+)/);
      if (!m) return;
      const ey = +m[2], hx = +m[3];
      const label = g.querySelector(".label"), tip = g.querySelector(".tip"), box = g.querySelector(".label-box");
      const fs = parseFloat(getComputedStyle(label).fontSize) || 15;
      const pad = fs * 0.55;
      label.setAttribute("x", hx + pad);
      if (tip) {
        const ts = parseFloat(getComputedStyle(tip).fontSize) || 9;
        const h = fs + 3 + ts;
        const top = ey - h / 2;
        label.setAttribute("y", top + fs * 0.8);
        tip.setAttribute("x", hx + pad);
        tip.setAttribute("y", top + fs + 3 + ts * 0.85);
      } else {
        label.setAttribute("y", ey + fs * 0.33);
      }
      try {
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        g.querySelectorAll("text").forEach((t) => {
          const b = t.getBBox();
          x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.width); y2 = Math.max(y2, b.y + b.height);
        });
        if (x2 > x1) {
          const vpad = fs * 0.32;
          box.setAttribute("x", hx);
          box.setAttribute("y", Math.min(y1 - vpad, ey - (y2 - y1) / 2 - vpad));
          box.setAttribute("width", x2 - hx + pad);
          box.setAttribute("height", y2 - y1 + vpad * 2);
        }
      } catch (e) {}
    });
  }
  if (document.querySelector(".world-map")) {
    layoutCallouts();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutCallouts);
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layoutCallouts, 150); });
  }

  /* ---------- Shop category filter ---------- */
  const cats = document.querySelector(".shop-cats");
  if (cats) {
    const apply = (cat) => {
      cats.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.cat === cat));
      let n = 0;
      document.querySelectorAll(".product-card").forEach((p) => {
        const ok = cat === "all" || (p.dataset.cats || "").split(" ").includes(cat);
        p.style.display = ok ? "" : "none"; if (ok) n++;
      });
      document.querySelector(".empty").style.display = n ? "none" : "block";
    };
    cats.addEventListener("click", (e) => {
      const a = e.target.closest("a"); if (!a) return;
      e.preventDefault(); history.replaceState(null, "", a.getAttribute("href")); apply(a.dataset.cat);
    });
    apply((location.hash || "#all").slice(1));
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const money = (m) => (m ? new Intl.NumberFormat("en-US", { style: "currency", currency: m.currencyCode || "USD" }).format(+m.amount) : "");
  const COMING_SOON = "Online ordering is coming soon.";

  /* ---------- Shopify Storefront API ---------- */
  async function storefront(query, variables = {}) {
    const r = await fetch(`https://${SHOP.domain}/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": SHOP.token },
      body: JSON.stringify({ query, variables }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.errors) throw new Error((j.errors && j.errors[0] && j.errors[0].message) || `Shopify ${r.status}`);
    return j.data;
  }
  const CART_FIELDS = `id checkoutUrl totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 50) { nodes { id quantity
      cost { totalAmount { amount currencyCode } }
      merchandise { ... on ProductVariant { id title image { url altText } product { title handle } } } } }`;

  const Shop = {
    cart: null,
    remember(cart) {
      this.cart = cart || null;
      store.set(CART_ID_KEY, cart ? cart.id : null);
      store.set(COUNT_KEY, cart && cart.totalQuantity ? String(cart.totalQuantity) : null);
      updateCartBadge(cart ? cart.totalQuantity : 0);
      return this.cart;
    },
    async load() {
      const id = store.get(CART_ID_KEY);
      if (!SHOP_READY || !id) return this.remember(null);
      const d = await storefront(`query($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`, { id });
      return this.remember(d.cart); // null once the order is placed or the cart has expired
    },
    async mutate(field, sig, args, vars) {
      const d = await storefront(`mutation(${sig}) { ${field}(${args}) { cart { ${CART_FIELDS} } userErrors { message } } }`, vars);
      const res = d[field];
      if (res.userErrors && res.userErrors.length) throw new Error(res.userErrors[0].message);
      return this.remember(res.cart);
    },
    async add(merchandiseId, quantity = 1) {
      const lines = [{ merchandiseId, quantity }];
      if (this.cart || store.get(CART_ID_KEY)) {
        try {
          return await this.mutate("cartLinesAdd", "$id: ID!, $lines: [CartLineInput!]!", "cartId: $id, lines: $lines", { id: store.get(CART_ID_KEY), lines });
        } catch (e) { /* cart expired or already checked out: start a new one */ }
      }
      return this.mutate("cartCreate", "$input: CartInput!", "input: $input", { input: { lines } });
    },
    update(lineId, quantity) {
      return this.mutate("cartLinesUpdate", "$id: ID!, $lines: [CartLineUpdateInput!]!", "cartId: $id, lines: $lines", { id: this.cart.id, lines: [{ id: lineId, quantity }] });
    },
    remove(lineId) {
      return this.mutate("cartLinesRemove", "$id: ID!, $ids: [ID!]!", "cartId: $id, lineIds: $ids", { id: this.cart.id, ids: [lineId] });
    },
  };
  if (SHOP_READY && store.get(CART_ID_KEY)) Shop.load().catch(() => {});
  else if (!SHOP_READY) Shop.remember(null);

  /* ---------- Multi-print discount (set the same tiers as an automatic discount in Shopify) ---------- */
  const BUNDLE = Array.isArray(cfg.bundleDiscount) && cfg.bundleDiscount.length ? cfg.bundleDiscount.slice().sort((a, b) => a.qty - b.qty) : null;
  function bundleHTML(count, withLink) {
    if (!BUNDLE) return "";
    const top = BUNDLE[BUNDLE.length - 1];
    const reached = BUNDLE.filter((t) => count >= t.qty).pop();
    const next = BUNDLE.find((t) => count < t.qty);
    const title = !count ? `Save ${BUNDLE.map((t, i) => `${t.percent}% on ${i === BUNDLE.length - 1 ? `${t.qty}+` : t.qty} prints`).join(", ")}`
      : next ? `${reached ? `You're saving ${reached.percent}%. ` : ""}Add ${next.qty - count === 1 ? "one more print" : `${next.qty - count} more prints`} for ${next.percent}% off your order`
      : `You're saving ${reached.percent}% on this order`;
    const fill = Math.min(100, (count / top.qty) * 100);
    return `<div class="bundle">
      <p class="bundle-title">${esc(title)}</p>
      <div class="bundle-bar"><span style="width:${fill}%"></span></div>
      <div class="bundle-steps">${BUNDLE.map((t, i) => `<span style="left:${(t.qty / top.qty) * 100}%"><b>${t.percent}% off</b>${i === BUNDLE.length - 1 ? `${t.qty}+` : t.qty} prints</span>`).join("")}</div>
      ${withLink ? `<a class="bundle-link" href="shop.html">Browse prints →</a>` : `<p class="bundle-sub">Mix any prints and sizes.</p>`}
    </div>`;
  }

  /* ---------- Cart view: used by the slide-in drawer and by cart.html ---------- */
  const icons = {
    x: `<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3l10 10M13 3L3 13"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>`,
    truck: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 6h12v10H2zM14 10h4l4 4v2h-8z"/><circle cx="6" cy="18" r="1.8" fill="#f3f3f1"/><circle cx="18" cy="18" r="1.8" fill="#f3f3f1"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  };
  const SHIPPING_NOTE = cfg.shippingNote || "Free shipping";
  const thumb = (url) => (url ? url + (url.includes("?") ? "&" : "?") + "width=240" : "");

  function cartViewHTML(cart, loading) {
    const lines = (cart && cart.lines && cart.lines.nodes) || [];
    if (!lines.length) {
      if (loading) return { body: `<div class="drawer-empty"><span class="spinner"></span></div>`, foot: "" };
      return { body: `<div class="drawer-empty">${cartIcon}<p>Your cart is empty</p><a href="shop.html">Continue shopping →</a></div>`, foot: "" };
    }
    const body = `${bundleHTML(cart.totalQuantity, true)}<ul>${lines.map((l) => {
      const v = l.merchandise || {}, p = v.product || {};
      const url = p.handle ? `${p.handle}.html` : "shop.html";
      const variant = v.title && v.title !== "Default Title" ? v.title : "";
      return `
      <li class="drawer-line" data-line="${esc(l.id)}" data-q="${l.quantity}">
        <a class="drawer-thumb" href="${esc(url)}">${v.image ? `<img src="${esc(thumb(v.image.url))}" alt="">` : ""}</a>
        <div class="drawer-info">
          <a class="drawer-title" href="${esc(url)}">${esc(p.title || "")}</a>
          ${variant ? `<p class="drawer-variant">${esc(variant)}</p>` : ""}
          <div class="drawer-row">
            <p class="drawer-price">${money(l.cost.totalAmount)}</p>
            <div class="stepper"><button class="minus" type="button" aria-label="Decrease quantity"${l.quantity <= 1 ? " disabled" : ""}>−</button><span>${l.quantity}</span><button class="plus" type="button" aria-label="Increase quantity"${l.quantity >= MAX_QTY ? " disabled" : ""}>+</button></div>
            <button class="remove" type="button" aria-label="Remove ${esc(p.title || "item")}">${icons.trash}</button>
          </div>
        </div>
      </li>`;
    }).join("")}</ul>`;
    const foot = `
      <p class="drawer-subtotal"><span>Subtotal</span><span>${money(cart.cost.subtotalAmount)}</span></p>
      <p class="drawer-ship">${icons.truck}${esc(SHIPPING_NOTE)}</p>
      <button class="drawer-checkout" type="button">Checkout</button>
      <p class="drawer-note" role="status"></p>
      <p class="drawer-secure">${icons.lock}Secure checkout · PayPal and cards accepted</p>`;
    return { body, foot };
  }

  // Wires up +/−/remove/checkout inside a cart view; `rerender` redraws it after each change.
  function bindCartView(root, rerender) {
    root.addEventListener("click", async (e) => {
      const note = () => root.querySelector(".drawer-note");
      const line = e.target.closest(".drawer-line");
      const btn = e.target.closest(".plus, .minus, .remove");
      if (line && btn) {
        const q = +line.dataset.q;
        line.classList.add("busy");
        root.querySelectorAll(".drawer-line button").forEach((b) => (b.disabled = true));
        try {
          if (btn.classList.contains("remove")) await Shop.remove(line.dataset.line);
          else await Shop.update(line.dataset.line, btn.classList.contains("plus") ? Math.min(MAX_QTY, q + 1) : Math.max(1, q - 1));
          rerender();
        } catch (err) {
          rerender();
          const n = note(); if (n) n.textContent = "Something went wrong. Please try again.";
        }
        return;
      }
      const co = e.target.closest(".drawer-checkout");
      if (co) {
        if (Shop.cart && Shop.cart.checkoutUrl) { co.classList.add("loading"); location.href = Shop.cart.checkoutUrl; }
        else note().textContent = COMING_SOON;
      }
    });
  }

  /* ---------- Cart drawer: slides in from the right (modelled on skypathstudio.com) ---------- */
  const cartIcon = cart;
  let drawer;
  function buildDrawer() {
    drawer = document.createElement("div");
    drawer.className = "drawer";
    drawer.hidden = true;
    drawer.innerHTML = `
      <div class="drawer-backdrop"></div>
      <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="Your cart">
        <div class="drawer-head"><h2>Your cart</h2><button class="drawer-close" type="button" aria-label="Close cart">${icons.x}</button></div>
        <div class="drawer-body"></div>
        <div class="drawer-foot"></div>
      </aside>`;
    document.body.append(drawer);
    drawer.querySelector(".drawer-backdrop").onclick = closeCart;
    drawer.querySelector(".drawer-close").onclick = closeCart;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("open")) closeCart(); });
    bindCartView(drawer, () => renderDrawer());
  }
  function renderDrawer(loading) {
    const { body, foot } = cartViewHTML(Shop.cart, loading);
    drawer.querySelector(".drawer-body").innerHTML = body;
    const f = drawer.querySelector(".drawer-foot");
    f.innerHTML = foot; f.hidden = !foot;
  }
  function openCart(fresh) {
    if (!drawer) buildDrawer();
    const needsLoad = !fresh && SHOP_READY && store.get(CART_ID_KEY);
    renderDrawer(needsLoad && !Shop.cart);
    if (needsLoad) Shop.load().then(() => renderDrawer(), () => renderDrawer());
    drawer.hidden = false;
    document.documentElement.classList.add("no-scroll");
    requestAnimationFrame(() => requestAnimationFrame(() => drawer.classList.add("open")));
    drawer.querySelector(".drawer-close").focus({ preventScroll: true });
  }
  function closeCart() {
    drawer.classList.remove("open");
    document.documentElement.classList.remove("no-scroll");
    setTimeout(() => { if (!drawer.classList.contains("open")) drawer.hidden = true; }, 320);
  }
  // The header cart icon opens the drawer (cart.html stays as a full page too).
  if (!document.querySelector("#cart")) {
    document.querySelectorAll(".site-header .cart").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openCart(); }));
  }

  /* ---------- Product page: options and prices come from Shopify ---------- */
  const prod = document.querySelector(".product-info");
  if (prod) {
    const wrap = prod.querySelector(".product-options");
    const priceEl = prod.querySelector(".price");
    const note = prod.querySelector(".form-note");
    const add = prod.querySelector(".add-cart");
    const bundleBox = prod.querySelector(".bundle-box");
    if (bundleBox) bundleBox.innerHTML = bundleHTML(0, false);

    // Until Shopify answers (or if the shop isn't connected yet), use the options written in the page.
    let model = {
      options: [...wrap.querySelectorAll(".options")].map((g) => ({ name: g.getAttribute("aria-label"), values: [...g.querySelectorAll("[data-value]")].map((b) => b.dataset.value) })),
      variants: [...wrap.querySelectorAll(".options [data-value]")].map((b) => ({
        id: null, available: true, price: { amount: b.dataset.price, currencyCode: "USD" },
        sel: { [b.closest(".options").getAttribute("aria-label")]: b.dataset.value },
      })),
    };
    let sel = {};
    const find = (s) => model.variants.find((v) => model.options.every((o) => v.sel[o.name] === s[o.name]));
    const pickDefault = () => {
      const v = model.variants.find((x) => x.available) || model.variants[0];
      sel = v ? { ...v.sel } : {};
    };
    const render = () => {
      wrap.innerHTML = model.options.filter((o) => !(o.values.length === 1 && o.values[0] === "Default Title")).map((o) => {
        const prices = new Set(o.values.map((val) => { const v = find({ ...sel, [o.name]: val }); return v ? v.price.amount : ""; }));
        return `<div class="opt-group">
          <p class="opt-label">${esc(o.name)} <span class="opt-chosen">${esc(sel[o.name] || "")}</span></p>
          <div class="options" role="radiogroup" aria-label="${esc(o.name)}">${o.values.map((val) => {
            const v = find({ ...sel, [o.name]: val });
            const off = !v || !v.available;
            return `<button type="button" role="radio" aria-checked="${sel[o.name] === val}" data-opt="${esc(o.name)}" data-value="${esc(val)}"${off ? ' class="soldout"' : ""}><span>${esc(val)}</span>${v && prices.size > 1 ? `<small>${money(v.price)}</small>` : ""}${v && prices.size === 1 && model.options.length === 1 ? `<small>${money(v.price)}</small>` : ""}</button>`;
          }).join("")}</div></div>`;
      }).join("");
      const v = find(sel);
      priceEl.textContent = v ? money(v.price) : "";
      const sold = !v || !v.available;
      add.disabled = sold;
      add.textContent = sold ? "Sold out" : "Add to cart";
    };
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest("[data-opt]"); if (!b) return;
      sel[b.dataset.opt] = b.dataset.value;
      if (!find(sel)) { // keep the click, then fall back to the first variant that has it
        const v = model.variants.find((x) => x.sel[b.dataset.opt] === b.dataset.value);
        if (v) sel = { ...v.sel };
      }
      note.textContent = "";
      render();
    });
    pickDefault(); render();

    if (SHOP_READY && prod.dataset.handle) {
      storefront(`query($h: String!) { product(handle: $h) { title options { name optionValues { name } }
          variants(first: 250) { nodes { id availableForSale selectedOptions { name value } price { amount currencyCode } } } } }`, { h: prod.dataset.handle })
        .then((d) => {
          const p = d.product;
          if (!p) { note.textContent = "This print isn't available to order right now."; add.disabled = true; return; }
          model = {
            options: p.options.map((o) => ({ name: o.name, values: o.optionValues.map((v) => v.name) })),
            variants: p.variants.nodes.map((v) => ({ id: v.id, available: v.availableForSale, price: v.price, sel: Object.fromEntries(v.selectedOptions.map((o) => [o.name, o.value])) })),
          };
          pickDefault(); render();
        })
        .catch(() => {});
    }

    add.onclick = async () => {
      const v = find(sel);
      if (!v) return;
      if (!SHOP_READY || !v.id) { note.textContent = COMING_SOON; return; }
      note.textContent = "";
      add.disabled = true; add.classList.add("adding"); add.textContent = "Adding…";
      try {
        await Shop.add(v.id, 1);
        openCart(true);
      } catch (err) {
        note.textContent = "Couldn't add this to your cart. Please try again.";
      }
      add.classList.remove("adding"); render();
    };
  }

  /* ---------- Cart page ---------- */
  const cartEl = document.querySelector("#cart");
  if (cartEl) {
    cartEl.classList.add("cart-view");
    const render = (loading) => {
      const { body, foot } = cartViewHTML(Shop.cart, loading);
      cartEl.innerHTML = `<div class="cart-view-body">${body}</div>${foot ? `<div class="cart-view-foot">${foot}</div>` : ""}`;
    };
    bindCartView(cartEl, () => render());
    const id = SHOP_READY && store.get(CART_ID_KEY);
    render(!!id);
    if (id) Shop.load().then(() => render(), () => render());
  }
})();
