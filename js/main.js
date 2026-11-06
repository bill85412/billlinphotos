(function () {
  const page = document.body.dataset.page || "";
  const cfg = window.SITE_CONFIG || {};

  /* ---------- Shop: the cart lives in this browser; checkout is PayPal, orders go to Prodigi (functions/) ---------- */
  const CART_KEY = "billlin-cart";
  const MAX_QTY = 10;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
  };
  // Cart lines: { slug, variant, quantity, title, price (cents, for display only — the server sets the real price), image }
  const Cart = {
    lines() {
      try { const a = JSON.parse(store.get(CART_KEY) || "[]"); return Array.isArray(a) ? a.filter((l) => l && l.slug && l.variant) : []; }
      catch (e) { return []; }
    },
    save(lines) { store.set(CART_KEY, lines.length ? JSON.stringify(lines) : null); updateCartBadge(); },
    count() { return this.lines().reduce((n, l) => n + (+l.quantity || 0), 0); },
    add(item) {
      const lines = this.lines();
      const hit = lines.find((l) => l.slug === item.slug && l.variant === item.variant);
      if (hit) { hit.quantity = Math.min(MAX_QTY, hit.quantity + 1); Object.assign(hit, { title: item.title, price: item.price, image: item.image }); }
      else lines.push({ ...item, quantity: 1 });
      this.save(lines);
    },
    setQty(i, q) { const lines = this.lines(); if (!lines[i]) return; lines[i].quantity = Math.max(1, Math.min(MAX_QTY, q)); this.save(lines); },
    remove(i) { const lines = this.lines(); lines.splice(i, 1); this.save(lines); },
    clear() { this.save([]); },
  };
  function updateCartBadge(n = Cart.count()) {
    document.querySelectorAll(".cart-count").forEach((el) => { el.textContent = n; el.hidden = !n; });
  }
  window.addEventListener("storage", (e) => { if (e.key === CART_KEY) updateCartBadge(); });

  /* ---------- Header & footer (shared across pages) ---------- */
  const nav = [
    ["index.html", "Home", "home"],
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

  /* ---------- Photo protection: no right-click "Save image", no dragging photos out, no long-press save ---------- */
  // (This only stops casual saving; anything shown on screen can still be screenshotted.)
  const isPhoto = (t) => t && t.closest && t.closest("img, .bg-section, .lightbox, .drawer-thumb, .product-card .ph");
  document.addEventListener("contextmenu", (e) => { if (isPhoto(e.target)) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if (e.target.tagName === "IMG") e.preventDefault(); });

  /* ---------- Lightbox: click a photo to view it large; zoom with wheel / pinch / double-click / buttons, drag to pan ---------- */
  const zoomables = [...document.querySelectorAll("figure.zoom")];
  if (zoomables.length) {
    const lb = document.createElement("div");
    lb.className = "lightbox";
    lb.innerHTML = `<button class="lb-close" aria-label="Close">×</button>
      <button class="lb-prev" aria-label="Previous">‹</button><img alt="" draggable="false"><button class="lb-next" aria-label="Next">›</button>
      <div class="lb-zoom"><button class="lb-out" aria-label="Zoom out">−</button><button class="lb-in" aria-label="Zoom in">+</button></div>`;
    document.body.append(lb);
    const lbImg = lb.querySelector("img");
    let group = [], idx = 0;
    // zoom state: scale s, offset (tx, ty) in screen px, transform-origin is the image centre
    let s = 1, tx = 0, ty = 0;
    const maxScale = () => Math.max(2, Math.min(4, (lbImg.naturalWidth || 0) / (lbImg.clientWidth || 1) * 1.5));
    const clamp = () => {
      const w = lbImg.clientWidth * s, h = lbImg.clientHeight * s;
      const mx = Math.max(0, (w - innerWidth) / 2 + 20), my = Math.max(0, (h - innerHeight) / 2 + 20);
      tx = Math.max(-mx, Math.min(mx, tx)); ty = Math.max(-my, Math.min(my, ty));
      if (s <= 1) { s = 1; tx = 0; ty = 0; }
    };
    const apply = (animate) => {
      clamp();
      lbImg.style.transition = animate ? "transform .25s ease" : "none";
      lbImg.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
      lb.classList.toggle("zoomed", s > 1);
    };
    // zoom to scale ns keeping the screen point (cx, cy) still
    const zoomTo = (ns, cx = innerWidth / 2, cy = innerHeight / 2, animate) => {
      ns = Math.max(1, Math.min(maxScale(), ns));
      const r = lbImg.getBoundingClientRect();
      const ox = r.left + r.width / 2 - tx, oy = r.top + r.height / 2 - ty; // centre without offset
      const px = (cx - ox - tx) / s, py = (cy - oy - ty) / s;
      tx = cx - ox - ns * px; ty = cy - oy - ns * py; s = ns;
      apply(animate);
    };
    const reset = () => { s = 1; tx = 0; ty = 0; apply(false); };
    const show = () => {
      const img = group[idx].tagName === "IMG" ? group[idx] : group[idx].querySelector("img");
      reset();
      lbImg.src = img.getAttribute("src");
      lbImg.alt = img.alt;
    };
    zoomables.forEach((f) => f.addEventListener("click", () => {
      if (f._swiped && Date.now() - f._swiped < 400) return;
      const gallery = f.closest(".product-gallery");
      if (gallery) { // product page: browse the print and its room views
        const thumbs = [...gallery.querySelectorAll(".pg-thumb:not([hidden])")];
        group = thumbs.map((t) => { const i = new Image(); i.src = t.dataset.src; i.alt = t.querySelector("img").alt; return i; });
        idx = Math.max(0, thumbs.findIndex((t) => t.classList.contains("active")));
      } else {
        const scope = f.closest("[data-group]") || document;
        group = scope.matches && scope.matches("figure.zoom") ? [scope] : [...scope.querySelectorAll("figure.zoom")];
        idx = group.indexOf(f);
      }
      show();
      lb.classList.toggle("single", group.length < 2);
      lb.classList.add("open");
    }));
    const close = () => { lb.classList.remove("open"); reset(); };
    lb.querySelector(".lb-close").onclick = close;
    lb.querySelector(".lb-prev").onclick = (e) => { e.stopPropagation(); idx = (idx - 1 + group.length) % group.length; show(); };
    lb.querySelector(".lb-next").onclick = (e) => { e.stopPropagation(); idx = (idx + 1) % group.length; show(); };
    lb.querySelector(".lb-in").onclick = (e) => { e.stopPropagation(); zoomTo(s * 1.6, undefined, undefined, true); };
    lb.querySelector(".lb-out").onclick = (e) => { e.stopPropagation(); zoomTo(s / 1.6, undefined, undefined, true); };
    lb.addEventListener("click", (e) => { if (e.target === lb && s === 1) close(); });
    lb.addEventListener("wheel", (e) => { e.preventDefault(); zoomTo(s * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY); }, { passive: false });
    lbImg.addEventListener("dblclick", (e) => { e.preventDefault(); zoomTo(s > 1 ? 1 : 2.5, e.clientX, e.clientY, true); });

    // drag to pan, pinch to zoom, double-tap to zoom (pointer events cover mouse and touch)
    const pts = new Map();
    let startDist = 0, startScale = 1, lastTap = 0, moved = false;
    lbImg.addEventListener("pointerdown", (e) => {
      lbImg.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (pts.size === 2) { const [p1, p2] = [...pts.values()]; startDist = Math.hypot(p1.x - p2.x, p1.y - p2.y); startScale = s; }
    });
    lbImg.addEventListener("pointermove", (e) => {
      const prev = pts.get(e.pointerId); if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY }; pts.set(e.pointerId, cur);
      if (pts.size === 2) {
        const [p1, p2] = [...pts.values()];
        zoomTo(startScale * Math.hypot(p1.x - p2.x, p1.y - p2.y) / (startDist || 1), (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        moved = true;
      } else if (s > 1) {
        tx += cur.x - prev.x; ty += cur.y - prev.y; apply(false);
        if (Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) > 2) moved = true;
      }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (e.pointerType === "touch" && !moved && pts.size === 0) {
        const now = Date.now();
        if (now - lastTap < 300) { zoomTo(s > 1 ? 1 : 2.5, e.clientX, e.clientY, true); lastTap = 0; } else lastTap = now;
      }
    };
    lbImg.addEventListener("pointerup", up);
    lbImg.addEventListener("pointercancel", up);
    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft" && group.length > 1) lb.querySelector(".lb-prev").click();
      if (e.key === "ArrowRight" && group.length > 1) lb.querySelector(".lb-next").click();
      if (e.key === "+" || e.key === "=") lb.querySelector(".lb-in").click();
      if (e.key === "-") lb.querySelector(".lb-out").click();
    });
    addEventListener("resize", () => { if (lb.classList.contains("open")) apply(false); });
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

  /* ---------- Product page gallery: thumbnails switch the main picture (print, living room, office) ---------- */
  document.querySelectorAll(".product-gallery").forEach((g) => {
    const main = g.querySelector(".pg-main img");
    const all = [...g.querySelectorAll(".pg-thumb")];
    // Room views carry data-material ("Canvas" / "Framed Print"); only the chosen material's views are shown.
    const shown = () => all.filter((t) => !t.hidden);
    const pick = (t) => {
      all.forEach((x) => { x.classList.toggle("active", x === t); x.toggleAttribute("aria-current", x === t); });
      main.srcset = t.dataset.srcset; main.src = t.dataset.src; main.alt = t.querySelector("img").alt;
      main.closest(".pg-main").classList.toggle("is-room", t !== all[0]);
    };
    const step = (d) => { const s = shown(); const i = s.findIndex((t) => t.classList.contains("active")); pick(s[(i + d + s.length) % s.length]); };
    all.forEach((t) => t.addEventListener("click", () => pick(t)));
    // called by the option buttons with the current choice ({ "Material": "Canvas", "Size": "16 × 24 in" }):
    // show only the room views for that material and size (data-material / data-size), and, when `jump`,
    // show the same room as before at the new choice (or the first room when the plain print was showing).
    g._choose = (choice, jump) => {
      if (!all.some((t) => t.dataset.material || t.dataset.size)) return;
      const fits = (t) => (!t.dataset.material || t.dataset.material === choice.Material) && (!t.dataset.size || t.dataset.size === choice.Size);
      const cur = all.find((t) => t.classList.contains("active"));
      all.forEach((t) => { t.hidden = !fits(t); });
      const room = cur && cur.dataset.room || "1";
      const target = all.find((t) => !t.hidden && t.dataset.room === room) || all.find((t) => !t.hidden && t.dataset.room);
      if (jump && target) pick(target);
      else if (cur && cur.hidden) pick(all[0]);
    };
    // ‹ › arrows on the main picture
    if (all.length > 1) {
      const fig = main.closest(".pg-main");
      [["prev", -1, "Previous view", "M15 5l-7 7 7 7"], ["next", 1, "Next view", "M9 5l7 7-7 7"]].forEach(([cls, d, label, path]) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = `pg-arrow pg-${cls}`; b.setAttribute("aria-label", label);
        b.innerHTML = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
        b.addEventListener("click", (e) => { e.stopPropagation(); step(d); });
        fig.append(b);
      });
      // keyboard ← → (not while typing, and not when the enlarged view or cart is open — those handle keys themselves)
      document.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
        if (document.querySelector(".lightbox.open, .drawer.open, .mobile-menu.open")) return;
        e.preventDefault();
        step(e.key === "ArrowRight" ? 1 : -1);
      });
    }
    // swipe the main picture on touch screens
    let x0 = null;
    main.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    main.addEventListener("touchend", (e) => {
      if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) < 40) return;
      step(dx < 0 ? 1 : -1);
      main.closest("figure")._swiped = Date.now();
    });
  });

  /* ---------- Product page: landscape photos go on top (.wide), portrait ones sit beside the text ---------- */
  const prodFig = document.querySelector(".product-layout .pg-main img, .product-layout figure img");
  if (prodFig) {
    // decided once, from the print itself (room views are all 3:2 and must not flip the layout)
    const shape = () => {
      if (!prodFig.naturalWidth) return;
      const ar = prodFig.naturalWidth / prodFig.naturalHeight;
      prodFig.closest(".product-layout").classList.toggle("wide", ar >= 1.25);
      const g = prodFig.closest(".product-gallery"); if (g) g.style.setProperty("--stage", ar.toFixed(3));
    };
    if (prodFig.complete) shape(); else prodFig.addEventListener("load", shape, { once: true });
  }

  /* ---------- Shop grid: make sure every card knows its photo's shape (--ar), for the justified rows ---------- */
  document.querySelectorAll(".product-card").forEach((c) => {
    if (c.style.getPropertyValue("--ar")) return;
    const img = c.querySelector("img"); if (!img) return;
    const set = () => img.naturalWidth && c.style.setProperty("--ar", (img.naturalWidth / img.naturalHeight).toFixed(3));
    img.complete ? set() : img.addEventListener("load", set, { once: true });
  });

  /* ---------- Shop category filter ---------- */
  const cats = document.querySelector(".shop-cats");
  if (cats) {
    const apply = (cat) => {
      cats.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.cat === cat));
      let n = 0;
      document.querySelectorAll(".product-card").forEach((p) => {
        const ok = (p.dataset.cats || "").split(" ").includes(cat);
        p.style.display = ok ? "" : "none"; if (ok) n++;
      });
      document.querySelector(".empty").style.display = n ? "none" : "block";
    };
    cats.addEventListener("click", (e) => {
      const a = e.target.closest("a"); if (!a) return;
      e.preventDefault(); history.replaceState(null, "", a.getAttribute("href")); apply(a.dataset.cat);
    });
    // no "All" tab: open on Prints unless the address names another category
    const known = [...cats.querySelectorAll("a")].map((a) => a.dataset.cat);
    const want = location.hash.slice(1);
    apply(known.includes(want) ? want : "prints");
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const money = (m) => (m ? new Intl.NumberFormat("en-US", { style: "currency", currency: m.currencyCode || "USD" }).format(+m.amount) : "");
  const COMING_SOON = "Online ordering is coming soon.";

  /* ---------- Cart view: used by the slide-in drawer and by cart.html ---------- */
  const icons = {
    x: `<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3l10 10M13 3L3 13"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>`,
    truck: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 6h12v10H2zM14 10h4l4 4v2h-8z"/><circle cx="6" cy="18" r="1.8" fill="#f3f3f1"/><circle cx="18" cy="18" r="1.8" fill="#f3f3f1"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  };
  const SHIPPING_NOTE = cfg.shippingNote || "Free shipping";
  const usd = (cents) => money({ amount: (+cents || 0) / 100, currencyCode: "USD" });

  function cartViewHTML() {
    const lines = Cart.lines();
    if (!lines.length) {
      return { body: `<div class="drawer-empty">${cartIcon}<p>Your cart is empty</p><a href="shop.html">Continue Shopping →</a></div>`, foot: "" };
    }
    const failed = /[?&]payment=failed/.test(location.search);
    const body = `<ul>${lines.map((l, i) => {
      const url = `${encodeURIComponent(l.slug)}.html`;
      return `
      <li class="drawer-line" data-i="${i}" data-q="${l.quantity}">
        <a class="drawer-thumb" href="${url}">${l.image ? `<img src="${esc(l.image)}" alt="">` : ""}</a>
        <div class="drawer-info">
          <a class="drawer-title" href="${url}">${esc(l.title || l.slug)}</a>
          <p class="drawer-variant">${esc(l.variant)}</p>
          <div class="drawer-row">
            <p class="drawer-price">${usd(l.price * l.quantity)}</p>
            <div class="stepper"><button class="minus" type="button" aria-label="Decrease quantity"${l.quantity <= 1 ? " disabled" : ""}>−</button><span>${l.quantity}</span><button class="plus" type="button" aria-label="Increase quantity"${l.quantity >= MAX_QTY ? " disabled" : ""}>+</button></div>
            <button class="remove" type="button" aria-label="Remove ${esc(l.title || "item")}">${icons.trash}</button>
          </div>
        </div>
      </li>`;
    }).join("")}</ul>`;
    const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0);
    const foot = `
      <p class="drawer-subtotal"><span>Subtotal</span><span>${usd(subtotal)}</span></p>
      <p class="drawer-ship">${icons.truck}${esc(SHIPPING_NOTE)}</p>
      <button class="drawer-checkout" type="button">Checkout</button>
      <p class="drawer-note" role="status">${failed ? "Your payment didn't go through. Please try again." : ""}</p>
      <p class="drawer-secure">${icons.lock}Secure checkout · PayPal and cards accepted</p>`;
    return { body, foot };
  }

  // Wires up +/−/remove/checkout inside a cart view; `rerender` redraws it after each change.
  function bindCartView(root, rerender) {
    root.addEventListener("click", async (e) => {
      const line = e.target.closest(".drawer-line");
      const btn = e.target.closest(".plus, .minus, .remove");
      if (line && btn) {
        const i = +line.dataset.i, q = +line.dataset.q;
        if (btn.classList.contains("remove")) Cart.remove(i);
        else Cart.setQty(i, btn.classList.contains("plus") ? q + 1 : q - 1);
        rerender();
        return;
      }
      const co = e.target.closest(".drawer-checkout");
      if (!co || co.classList.contains("loading")) return;
      const note = root.querySelector(".drawer-note");
      note.textContent = "";
      co.classList.add("loading"); co.disabled = true;
      try {
        const r = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: Cart.lines().map((l) => ({ slug: l.slug, variant: l.variant, quantity: l.quantity })) }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.url) { location.href = j.url; return; }
        note.textContent = (r.status === 503 || (r.status === 404 && !j.error)) ? COMING_SOON : j.error || "Checkout is unavailable right now. Please try again in a moment.";
      } catch (err) {
        note.textContent = "Checkout is unavailable right now. Please try again in a moment.";
      }
      co.classList.remove("loading"); co.disabled = false;
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
      <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="Your Cart">
        <div class="drawer-head"><h2>Your Cart</h2><button class="drawer-close" type="button" aria-label="Close cart">${icons.x}</button></div>
        <div class="drawer-body"></div>
        <div class="drawer-foot"></div>
      </aside>`;
    document.body.append(drawer);
    drawer.querySelector(".drawer-backdrop").onclick = closeCart;
    drawer.querySelector(".drawer-close").onclick = closeCart;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("open")) closeCart(); });
    bindCartView(drawer, () => renderDrawer());
  }
  function renderDrawer() {
    const { body, foot } = cartViewHTML();
    drawer.querySelector(".drawer-body").innerHTML = body;
    const f = drawer.querySelector(".drawer-foot");
    f.innerHTML = foot; f.hidden = !foot;
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
  // The header cart icon opens the drawer (cart.html stays as a full page too).
  if (!document.querySelector("#cart")) {
    document.querySelectorAll(".site-header .cart").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openCart(); }));
  }

  /* ---------- Product page: option buttons (data-value / data-price) → Add to Cart ---------- */
  const prod = document.querySelector(".product-info");
  if (prod) {
    const wrap = prod.querySelector(".product-options");
    const priceEl = prod.querySelector(".price");
    const note = prod.querySelector(".form-note");
    const add = prod.querySelector(".add-cart");
    const slug = prod.dataset.handle;
    const title = (prod.querySelector("h1") || {}).textContent || document.title;
    const pic = document.querySelector(".pg-main img, .product-layout img");
    const image = pic ? pic.getAttribute("src").replace(/^images\/(?!sm\/)/, "images/sm/") : "";

    // Option groups in the HTML: <div class="options" aria-label="Material|Size"> with <button data-value …>.
    // A button's price is data-price, or data-prices='{"<value of another group>": price}' when it depends on that choice.
    // The cart variant is the chosen values joined with " / " (e.g. "Canvas / 16 × 24 in"), as in the server catalog.
    const groups = [...wrap.querySelectorAll(".options")].map((g) => ({
      name: g.getAttribute("aria-label"),
      values: [...g.querySelectorAll("[data-value]")].map((b) => ({
        value: b.dataset.value,
        price: b.dataset.price != null ? Math.round(parseFloat(b.dataset.price) * 100) : null,
        prices: b.dataset.prices ? JSON.parse(b.dataset.prices) : null,
      })),
    }));
    const sel = groups.map((g) => g.values[0]);
    // price of a full choice: the first button with a price that matches the rest of the choice
    const priceOf = (choice) => {
      for (const v of choice) {
        if (v.prices) { const other = choice.find((o) => o !== v && v.prices[o.value] != null); if (other) return Math.round(v.prices[other.value] * 100); }
        else if (v.price != null) return v.price;
      }
      return null;
    };
    const variant = () => sel.map((v) => v.value).join(" / ");
    const render = () => {
      wrap.innerHTML = groups.map((g, gi) => `<div class="opt-group">
          <p class="opt-label">${esc(g.name)}</p>
          <div class="options" role="radiogroup" aria-label="${esc(g.name)}">${g.values.map((v) => {
            const p = priceOf(sel.map((s, i) => (i === gi ? v : s)));
            const na = p == null && gi > 0; // the first group (Material) always stays clickable; picking it moves the size if needed
            return `<button type="button" role="radio" aria-checked="${sel[gi] === v}" data-g="${gi}" data-value="${esc(v.value)}"${na ? ' disabled class="unavailable"' : ""}><span>${esc(v.value)}</span>${p != null ? `<small>${usd(p)}</small>` : na ? "<small>Not available</small>" : ""}</button>`;
          }).join("")}</div></div>`).join("");
      const p = priceOf(sel);
      priceEl.textContent = p != null ? usd(p) : "";
      add.disabled = p == null;
    };
    const choice = () => Object.fromEntries(groups.map((g, i) => [g.name, sel[i].value]));
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest("[data-value]"); if (!b) return;
      const gi = +b.dataset.g, g = groups[gi];
      const before = sel[gi];
      sel[gi] = g.values.find((v) => v.value === b.dataset.value) || sel[gi];
      // the new choice may not exist (e.g. no framed 24 × 36): move the other groups to the nearest option that does
      groups.forEach((og, oi) => {
        if (oi === gi || priceOf(sel) != null) return;
        const ok = og.values.filter((v) => priceOf(sel.map((s2, i) => (i === oi ? v : s2))) != null);
        if (ok.length) sel[oi] = ok[ok.length - 1];
      });
      note.textContent = "";
      render();
      if (gal && gal._choose && sel[gi] !== before) gal._choose(choice(), true);
    });
    render();
    const gal = document.querySelector(".product-gallery");
    if (gal && gal._choose && groups.length) gal._choose(choice(), false);

    add.onclick = () => {
      const price = priceOf(sel);
      if (price == null || !slug) return;
      Cart.add({ slug, variant: variant(), title, price, image });
      note.textContent = "";
      add.classList.add("adding"); add.textContent = "Added";
      setTimeout(() => { add.classList.remove("adding"); add.textContent = "Add to Cart"; }, 900);
      openCart();
    };
  }

  /* ---------- Cart page ---------- */
  const cartEl = document.querySelector("#cart");
  if (cartEl) {
    cartEl.classList.add("cart-view");
    const render = () => {
      const { body, foot } = cartViewHTML();
      cartEl.innerHTML = `<div class="cart-view-body">${body}</div>${foot ? `<div class="cart-view-foot">${foot}</div>` : ""}`;
    };
    bindCartView(cartEl, render);
    render();
  }

  /* ---------- Order confirmed: the payment went through, so empty the cart ---------- */
  if (document.querySelector(".order-done")) Cart.clear();
  updateCartBadge();
})();
