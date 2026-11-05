(function () {
  const page = document.body.dataset.page || "";
  const cfg = window.SITE_CONFIG || {};

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
      <a class="cart" href="shop.html" aria-label="Shop">${cart}</a>
    </div>
    <button class="menu-toggle" aria-label="Open menu"><span></span><span></span></button>`;
  document.body.prepend(header);

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

  /* ---------- Product page ---------- */
  const prod = document.querySelector(".product-info");
  if (prod) {
    const sel = prod.querySelector("select");
    const price = prod.querySelector(".price");
    const qty = prod.querySelector(".qty input");
    const note = prod.querySelector(".form-note");
    const min = Math.min(...[...sel.options].filter((o) => o.value).map((o) => +o.dataset.price));
    sel.onchange = () => {
      const o = sel.selectedOptions[0];
      price.textContent = o.value ? `$${(+o.dataset.price).toFixed(2)}` : `from $${min.toFixed(2)}`;
      note.textContent = "";
    };
    prod.querySelector(".minus").onclick = () => (qty.value = Math.max(1, +qty.value - 1));
    prod.querySelector(".plus").onclick = () => (qty.value = +qty.value + 1);
    prod.querySelector(".add").onclick = () => {
      if (!sel.value) { note.textContent = "Please select Material."; return; }
      const slug = prod.dataset.slug;
      const link = ((cfg.stripeLinks || {})[slug] || {})[sel.value];
      if (link) { location.href = link; return; }
      note.textContent = "Online ordering is coming soon.";
    };
  }
})();
