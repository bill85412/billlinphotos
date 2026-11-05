(function () {
  const page = document.body.dataset.page || "";
  const cfg = window.SITE_CONFIG || {};

  /* ---------- Cart (kept in this browser; prices are re-checked on the server at checkout) ---------- */
  const CART_KEY = "billlin-cart";
  const MAX_QTY = 10;
  const Cart = {
    read() { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; } },
    write(items) { try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) {} updateCartBadge(); },
    count() { return this.read().reduce((n, i) => n + i.quantity, 0); },
    add(item) {
      const items = this.read();
      const same = items.find((i) => i.slug === item.slug && i.variant === item.variant);
      if (same) same.quantity = Math.min(MAX_QTY, same.quantity + item.quantity);
      else items.push({ ...item, quantity: Math.min(MAX_QTY, item.quantity) });
      this.write(items);
    },
    clear() { this.write([]); },
  };
  const money = (n) => `$${(+n).toFixed(2)}`;
  function updateCartBadge() {
    const n = Cart.count();
    document.querySelectorAll(".cart-count").forEach((el) => { el.textContent = n; el.hidden = !n; });
  }
  window.addEventListener("storage", (e) => { if (e.key === CART_KEY) updateCartBadge(); });

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
  footer.innerHTML = `<p>Copyright © 2023 by Bill Lin</p>`;
  document.body.append(footer);

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

  /* ---------- Checkout: send the cart to the server, which returns the PayPal payment page ---------- */
  async function startCheckout(btn, note) {
    const label = btn.textContent;
    btn.disabled = true; btn.classList.add("loading"); note.textContent = "";
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: Cart.read().map(({ slug, variant, quantity }) => ({ slug, variant, quantity })) }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.url) { location.href = data.url; return; }
      // No checkout function here yet (preview, or keys not set up): say so plainly.
      note.textContent = r.status === 503 || !data.error ? "Online ordering is coming soon." : data.error;
    } catch (err) {
      note.textContent = "Online ordering is coming soon.";
    }
    btn.disabled = false; btn.classList.remove("loading"); btn.textContent = label;
  }

  /* ---------- Cart drawer: slides in from the right (modelled on skypathstudio.com) ---------- */
  const SHIPPING_NOTE = "Free shipping";   // keep in step with SHIPPING in functions/_lib/catalog.js
  const icons = {
    x: `<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3l10 10M13 3L3 13"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>`,
    truck: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 6h12v10H2zM14 10h4l4 4v2h-8z"/><circle cx="6" cy="18" r="1.8" fill="var(--drawer-bg)"/><circle cx="18" cy="18" r="1.8" fill="var(--drawer-bg)"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  };
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
    drawer.addEventListener("click", (e) => {
      const line = e.target.closest(".drawer-line");
      if (line) {
        const items = Cart.read(), it = items[+line.dataset.k];
        if (!it) return;
        if (e.target.closest(".plus")) it.quantity = Math.min(MAX_QTY, it.quantity + 1);
        else if (e.target.closest(".minus")) it.quantity = Math.max(1, it.quantity - 1);
        else if (e.target.closest(".remove")) items.splice(+line.dataset.k, 1);
        else return;
        Cart.write(items); renderDrawer(); return;
      }
      const btn = e.target.closest(".drawer-checkout");
      if (btn) startCheckout(btn, drawer.querySelector(".drawer-note"));
    });
  }
  function renderDrawer() {
    const items = Cart.read();
    const body = drawer.querySelector(".drawer-body"), foot = drawer.querySelector(".drawer-foot");
    if (!items.length) {
      body.innerHTML = `<div class="drawer-empty">${cart}<p>Your cart is empty</p><a href="shop.html">Continue shopping →</a></div>`;
      foot.hidden = true; foot.innerHTML = "";
      return;
    }
    body.innerHTML = `<ul>${items.map((i, k) => `
      <li class="drawer-line" data-k="${k}">
        <a class="drawer-thumb" href="${esc(i.url)}">${i.image ? `<img src="${esc(i.image)}" alt="">` : ""}</a>
        <div class="drawer-info">
          <a class="drawer-title" href="${esc(i.url)}">${esc(i.title)}</a>
          <p class="drawer-variant">${esc(i.variant)}</p>
          <div class="drawer-row">
            <p class="drawer-price">${money(i.price * i.quantity)}</p>
            <div class="stepper"><button class="minus" type="button" aria-label="Decrease quantity"${i.quantity <= 1 ? " disabled" : ""}>−</button><span>${i.quantity}</span><button class="plus" type="button" aria-label="Increase quantity"${i.quantity >= MAX_QTY ? " disabled" : ""}>+</button></div>
            <button class="remove" type="button" aria-label="Remove ${esc(i.title)}">${icons.trash}</button>
          </div>
        </div>
      </li>`).join("")}</ul>`;
    const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
    foot.hidden = false;
    foot.innerHTML = `
      <p class="drawer-subtotal"><span>Subtotal</span><span>${money(subtotal)}</span></p>
      <p class="drawer-ship">${icons.truck}${SHIPPING_NOTE}</p>
      <button class="drawer-checkout" type="button">Checkout</button>
      <p class="drawer-note" role="status"></p>
      <p class="drawer-secure">${icons.lock}Secure checkout with PayPal · cards accepted</p>`;
  }
  function openCart() {
    if (!drawer) buildDrawer();
    renderDrawer();
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
  // The header cart icon opens the drawer (cart.html stays as a full page, e.g. after cancelling PayPal).
  if (!document.querySelector("#cart")) {
    document.querySelectorAll(".site-header .cart").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openCart(); }));
  }

  /* ---------- Product page: option buttons, "Adding…", then the drawer ---------- */
  const prod = document.querySelector(".product-info");
  if (prod) {
    const opts = [...prod.querySelectorAll(".options [data-value]")];
    const price = prod.querySelector(".price");
    const chosen = prod.querySelector(".opt-chosen");
    const note = prod.querySelector(".form-note");
    const optionName = prod.querySelector(".options")?.getAttribute("aria-label") || "Option";
    let current = opts.find((o) => o.getAttribute("aria-checked") === "true") || opts[0];
    const pick = (o) => {
      current = o;
      opts.forEach((b) => b.setAttribute("aria-checked", b === o ? "true" : "false"));
      price.textContent = money(o.dataset.price);
      if (chosen) chosen.textContent = o.dataset.value;
      note.textContent = "";
    };
    opts.forEach((o) => (o.onclick = () => pick(o)));
    if (current) pick(current);
    const photo = document.querySelector(".product-layout figure img");
    const add = prod.querySelector(".add-cart");
    const label = add.textContent;
    add.onclick = () => {
      if (!current) return;
      const item = {
        slug: prod.dataset.slug,
        title: prod.dataset.title || prod.querySelector("h1")?.textContent.trim(),
        option: optionName,
        variant: current.dataset.value,
        price: +current.dataset.price,
        image: photo ? photo.getAttribute("src").replace(/^images\//, "images/sm/") : "",
        url: location.pathname.split("/").pop() || `${prod.dataset.slug}.html`,
        quantity: 1,
      };
      add.disabled = true; add.classList.add("adding"); add.textContent = "Adding…";
      setTimeout(() => {
        Cart.add(item);
        add.disabled = false; add.classList.remove("adding"); add.textContent = label;
        openCart();
      }, 600);
    };
  }

  /* ---------- Cart page ---------- */
  const cartEl = document.querySelector("#cart");
  if (cartEl) {
    const failed = new URLSearchParams(location.search).get("payment") === "failed";
    const x = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3l10 10M13 3L3 13"/></svg>`;
    const render = (message = failed ? "Your payment didn't go through, so nothing was charged. Please try again." : "") => {
      const items = Cart.read();
      if (!items.length) {
        cartEl.innerHTML = `<div class="cart-empty"><p>You have nothing in your shopping cart.</p><a class="btn btn-solid" href="shop.html">Continue Shopping</a></div>`;
        return;
      }
      const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
      cartEl.innerHTML = `
        <ul class="cart-lines">
          ${items.map((i, k) => `
            <li class="cart-line" data-k="${k}">
              <a class="cart-thumb" href="${esc(i.url)}">${i.image ? `<img src="${esc(i.image)}" alt="">` : ""}</a>
              <div class="cart-desc">
                <a class="cart-title" href="${esc(i.url)}">${esc(i.title)}</a>
                <p class="cart-variant">${esc(i.option || "Material")}: ${esc(i.variant)}</p>
              </div>
              <div class="cart-qty"><button class="minus" type="button" aria-label="Decrease quantity">−</button><span>${i.quantity}</span><button class="plus" type="button" aria-label="Increase quantity">+</button></div>
              <p class="cart-price">${money(i.price * i.quantity)}</p>
              <button class="cart-remove" type="button" aria-label="Remove ${esc(i.title)}">${x}</button>
            </li>`).join("")}
        </ul>
        <div class="cart-summary">
          <p class="cart-subtotal"><span>Subtotal</span><span>${money(subtotal)}</span></p>
          <button class="btn btn-solid cart-checkout" type="button">Checkout</button>
          <p class="cart-note" role="status">${esc(message)}</p>
        </div>`;
    };
    cartEl.addEventListener("click", (e) => {
      const line = e.target.closest(".cart-line");
      if (line) {
        const items = Cart.read(), it = items[+line.dataset.k];
        if (!it) return;
        if (e.target.closest(".plus")) it.quantity = Math.min(MAX_QTY, it.quantity + 1);
        else if (e.target.closest(".minus")) it.quantity = Math.max(1, it.quantity - 1);
        else if (e.target.closest(".cart-remove")) items.splice(+line.dataset.k, 1);
        else return;
        Cart.write(items); render(""); return;
      }
      const btn = e.target.closest(".cart-checkout");
      if (btn) startCheckout(btn, cartEl.querySelector(".cart-note"));
    });
    render();
  }

  /* ---------- Order confirmed: empty the cart ---------- */
  if (document.querySelector(".order-done")) Cart.clear();
})();
