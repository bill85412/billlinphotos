# Bill Lin Photography — 自管網站

從 Squarespace 原站搬過來的網站。頁面是純 HTML / CSS / JavaScript，商店的結帳和自動下單則由 Cloudflare Pages Functions 處理。照片都放在 `images/` 裡。

## 上線

放在 **Cloudflare Pages**，連到這個 GitHub 儲存庫，main 分支一有更新，網站就會自動重新部署。
（商店功能必須在 Cloudflare Pages 上才能運作；直接雙擊 `index.html` 只能看版面，按「Add To Cart」會顯示「Online ordering is coming soon.」）

## 商店：Stripe 收款 + Prodigi 自動印刷出貨

流程：客人選規格 → Stripe 結帳頁付款、填地址 → Stripe 通知網站 → 網站自動向 Prodigi 下單 → Prodigi 印刷並直接寄給客人。

### 一次性設定

1. **Prodigi**：註冊帳號，在後台 Settings 取得 API 金鑰。先用測試用的 `sandbox_` 金鑰，測試沒問題再換成正式的 `live_` 金鑰，並在 Prodigi 綁定付款卡（Prodigi 會從這張卡扣印刷費和運費）。
2. **確認商品編號（SKU）**：在 Prodigi 的產品目錄找到要賣的品項和尺寸，把 SKU 填進 `functions/_lib/catalog.js`。目前填的 `GLOBAL-CAN-16X24`（畫布）和 `GLOBAL-CFPM-16X24`（裱框）是暫定的，上線前一定要核對。
3. **原檔**：在 Cloudflare 後台建立 R2 儲存空間，名稱 `print-files`，上傳每張要賣的照片的原始高解析檔（例如 `transient-serenity.jpg`）。這些檔案不會公開，只有 Prodigi 拿得到。
4. **Stripe**：註冊帳號，在 Developers → API keys 取得 Secret key。到 Developers → Webhooks 新增一個端點，網址填 `https://你的網域/api/stripe-webhook`，事件勾選 `checkout.session.completed` 和 `checkout.session.async_payment_succeeded`，建立後複製 Signing secret。
5. **Cloudflare Pages 設定**（專案 → Settings）：
   - Environment variables（全部用加密的 Secret 類型）：
     - `STRIPE_SECRET_KEY` — Stripe 的 Secret key
     - `STRIPE_WEBHOOK_SECRET` — Stripe webhook 的 Signing secret
     - `PRODIGI_API_KEY` — Prodigi 金鑰（`sandbox_...` 或 `live_...`）
     - `PRINT_FILE_TOKEN` — 自己取一串夠長的隨機英數字，用來保護原檔
     - `SITE_URL` — 網站網址，例如 `https://billlinphoto.com`
   - Bindings：新增 R2 bucket，Variable name 填 `PRINT_FILES`，選 `print-files`。
   - 改完後重新部署一次。

金鑰只填在 Stripe、Prodigi 和 Cloudflare 的後台，不要寫進程式碼，也不要貼到對話裡。

### 測試

用 Stripe 的測試金鑰（`sk_test_...`）和 Prodigi 的 `sandbox_` 金鑰，在網站上下一筆單，用 Stripe 的測試卡 `4242 4242 4242 4242` 付款。之後可以在 Prodigi 測試後台看到這筆訂單。測試金鑰不會真的扣款，也不會真的印刷。

### 價格、運費、可寄送國家

都在 `functions/_lib/catalog.js`：價格單位是美分（`10000` = $100.00）；`SHIPPING` 是向客人收的運費（目前免運）；`SHIP_TO` 是可寄送的國家。

## 常見修改

- **換文字**：打開對應的 `.html` 直接改。
- **加照片到相簿**：照片放進 `images/`，在相簿頁複製一行 `<figure class="zoom">…</figure>`。
- **新增商品**：複製 `transient-serenity.html` 改內容，在 `shop.html` 加一張商品卡，再到 `functions/_lib/catalog.js` 加上價格、SKU 和原檔名稱。
- **選單、IG / YouTube 連結**：在 `js/main.js` 最上面。

## 檔案結構

```
index.html               首頁
about.html               About
gallery.html             Gallery（世界地圖、瀑布流、Autumn in Boston、New York City）
boston.html              Boston 相簿
new-york.html            New York 相簿
blog.html                Blog 列表
autumn-in-boston.html    文章
shop.html                商店
transient-serenity.html  商品頁
order-success.html       付款完成頁
404.html                 找不到頁面
css/style.css            全站樣式
js/main.js               導覽列、頁尾、地圖、瀑布流、燈箱、商品頁
functions/               伺服器端程式：結帳、Stripe 通知、Prodigi 下單、原檔
functions/_lib/catalog.js  商品價格、Prodigi SKU、運費、寄送國家
tests/shop.test.mjs      商店流程測試（模擬 Stripe 與 Prodigi）
images/                  照片（網頁版 2560px；sm/ 是縮圖；full/ 是點開放大用的高畫質版本）
```
