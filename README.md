# Bill Lin Photography — 自管網站

從 Squarespace 原站搬過來的網站。頁面是純 HTML / CSS / JavaScript，商店的 PayPal 結帳和 Prodigi 自動下單由 Cloudflare Pages Functions 處理。照片都放在 `images/` 裡。

## 上線

放在 **Cloudflare Pages**，連到這個 GitHub 儲存庫，main 分支一有更新，網站就會自動重新部署。
（商店功能必須在 Cloudflare Pages 上才能運作；直接雙擊 `index.html` 只能看版面，按「Checkout」會顯示「Online ordering is coming soon.」）

## 商店：PayPal 收款 + Prodigi 自動印刷出貨

流程：客人選規格加入購物車 → 在購物車按「Checkout」→ 跳到 PayPal 付款（可用 PayPal 帳號或直接刷卡）→ 回到網站看到「訂單完成」→ PayPal 通知網站 → 網站自動向 Prodigi 下單 → Prodigi 印刷並直接寄給客人。

### 一次性設定

1. **PayPal**：申請 PayPal 商業帳戶（Business）。到 [developer.paypal.com](https://developer.paypal.com) 登入 → Apps & Credentials，先在 **Sandbox** 建立一個 App，取得 Client ID 和 Secret。
   在同一個 App 裡新增 Webhook：網址填 `https://你的網域/api/paypal-webhook`，事件勾 `Payment capture completed`，建立後記下 Webhook ID。
   測試完成後，切到 **Live** 重做一次，換成正式的 Client ID、Secret 和 Webhook ID。
2. **Prodigi**：註冊帳號，在後台 Settings 取得 API 金鑰。先用 `sandbox_` 開頭的測試金鑰，確定沒問題再換成 `live_`，並綁定付款卡（印刷費和運費會從這張卡扣）。建議在 Prodigi 設定訂單「暫停期」（例如 2 小時），讓客人有時間取消。
3. **確認商品編號（SKU）**：在 Prodigi 產品目錄找到要賣的品項和尺寸，填進 `functions/_lib/catalog.js`。目前用畫布 `GLOBAL-SLIMCAN-16X24/24X36` 和裱框 `GLOBAL-CFPM-12X18/16X24`（GLOBAL 開頭 = 由離買家最近的工廠製作）。
4. **原檔**：在 Cloudflare 後台建立 R2 儲存空間，名稱 `print-files`，上傳要賣的照片原始高解析檔，檔名要跟 `functions/_lib/catalog.js` 的 `printFile` 一樣：`transient-serenity.jpg`、`boston-public-library.jpg`、`fenway-park.jpg`、`nature-in-city.jpg`。這些檔案不公開，只有 Prodigi 拿得到。網站也會在這裡的 `orders/` 資料夾記錄已送出的訂單，避免重複下單。
5. **Cloudflare Pages 設定**（專案 → Settings）：
   - Environment variables（全部用加密的 Secret 類型）：
     - `PAYPAL_CLIENT_ID`、`PAYPAL_CLIENT_SECRET` — PayPal App 的 Client ID 和 Secret
     - `PAYPAL_WEBHOOK_ID` — PayPal Webhook ID
     - `PAYPAL_ENV` — 測試時填 `sandbox`，正式開賣填 `live`
     - `PRODIGI_API_KEY` — Prodigi 金鑰（`sandbox_...` 或 `live_...`）
     - `PRINT_FILE_TOKEN` — 自己取一串夠長的隨機英數字，用來保護原檔
     - `SITE_URL` — 網站網址，例如 `https://billlinphotos.com`
   - Bindings：新增 R2 bucket，Variable name 填 `PRINT_FILES`，選 `print-files`。
   - 改完後重新部署一次。

金鑰只填在 PayPal、Prodigi 和 Cloudflare 的後台，不要寫進程式碼，也不要貼到對話裡。

### 測試

`PAYPAL_ENV` 設成 `sandbox`、Prodigi 用 `sandbox_` 金鑰。PayPal 開發者後台的 Sandbox → Accounts 會有一個測試用的買家帳號，用它在網站上下單付款，之後可以在 Prodigi 的測試後台看到這筆訂單。測試模式不會真的扣款，也不會真的印刷。

### 退貨退款

- 損壞、印刷瑕疵、寄錯：客人到貨 30 天內附照片聯絡 → 免費重印（到 Prodigi 後台對那筆訂單申請 reprint，Prodigi 自己的品質問題不收費），或在 PayPal 全額退款。不用寄回。
- 遺失：寄出 30 天未到或物流停止更新 → 重印或退款。
- 取消：下單 2 小時內可全額取消（需在 Prodigi 設定 2 小時暫停期），到 Prodigi 後台取消訂單，再到 PayPal 退款。
- 改變心意、選錯尺寸：恕不退換（客製印製）。
- 退款方式：PayPal 後台找到那筆交易按「退款」。PayPal 退款不會自動取消 Prodigi 訂單，兩邊要分開處理。

### 價格、運費

都在 `functions/_lib/catalog.js`：價格單位是美分（`10000` = $100.00）；`SHIPPING` 是向客人收的運費（目前免運；若改成收運費，購物車側欄的「Free shipping」字樣在 `js/main.js` 的 `SHIPPING_NOTE` 也要改）。改價格時，商品頁選項按鈕的 `data-price` 和按鈕上顯示的價格也要一起改，購物車才會顯示正確的金額（實際收費以伺服器端為準）。

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
transient-serenity.html  商品頁（另有 boston-public-library、fenway-park、tow-zone）
cart.html                購物車
order-success.html       付款完成頁
404.html                 找不到頁面
css/style.css            全站樣式
js/main.js               導覽列、頁尾、地圖、瀑布流、燈箱、商品頁
functions/               伺服器端程式：PayPal 結帳、付款通知、Prodigi 下單、原檔
functions/_lib/catalog.js  商品價格、Prodigi SKU、運費
tests/shop.test.mjs      商店流程測試（模擬 PayPal 與 Prodigi）
js/config.js             購物車顯示的運費文字
images/                  照片（網頁版 2560px；sm/ 是縮圖；mockups/ 是實景示意圖）
```
