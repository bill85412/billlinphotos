# Bill Lin Photography — 自管網站

從 Squarespace 原站搬過來的網站。頁面是純 HTML / CSS / JavaScript；商店的購物車與結帳接 Shopify，由 Prodigi 自動印刷出貨。照片都放在 `images/` 裡。

## 上線

放在 **Cloudflare Pages**，連到這個 GitHub 儲存庫，main 分支一有更新，網站就會自動重新部署。網站本身是純靜態頁面，沒有伺服器程式。

## 商店：Shopify 結帳 + Prodigi 自動印刷出貨（比照 skypathstudio.com）

流程：客人在網站選規格加入購物車（購物車資料存在 Shopify）→ 按「Checkout」跳到 Shopify 結帳頁 → 用 PayPal 付款（也可以直接刷卡）→ Shopify 寄訂單確認信 → Prodigi 的 Shopify App 自動接單、印刷，直接寄給客人 → 物流追蹤號碼自動回到 Shopify，並通知客人。

價格、規格、庫存、折扣、運費、訂單、退款，全部在 Shopify 後台管理。

### 一次性設定
1. **Shopify**：註冊並選 Basic 方案。Settings → Payments 開啟 **PayPal**（台灣不能用 Shopify Payments）。
2. **Prodigi**：在 Shopify App Store 安裝「Prodigi Global Print on Demand」，連結 Prodigi 帳號並綁定付款卡（印刷費和運費從這張卡扣）。
3. **建立商品**：在 Shopify 建立商品和規格（例如材質、尺寸），網址代稱（handle）要跟網站的商品頁檔名一樣，例如 `transient-serenity`。到 Prodigi App 把每個規格對應到 Prodigi 品項，並上傳高解析原檔。
4. **運費**：Settings → Shipping 設定成免運（運費算進售價），網站購物車會顯示「Free shipping」。
5. **連接網站**：在 Shopify 安裝「Headless」銷售管道，建立 Storefront，取得 **Public access token**。把商店網址（xxx.myshopify.com）和這把公開金鑰填進 `js/config.js`（這把金鑰本來就是公開放在網頁裡用的）。
6. **多張折扣（選用）**：在 Shopify → Discounts 建立自動折扣（例如 2 件 9 折、3 件以上 8 折），再把同樣的級距填進 `js/config.js` 的 `bundleDiscount`，購物車就會顯示折扣進度條。

沒填 Shopify 設定前，商品頁照常顯示，按「Add to cart」會出現「Online ordering is coming soon.」

### 退款
在 Shopify 後台的訂單頁按「Refund」。退款不會自動取消 Prodigi 的訂單，要到 Prodigi 後台另外處理。

## 常見修改

- **換文字**：打開對應的 `.html` 直接改。
- **加照片到相簿**：照片放進 `images/`，在相簿頁複製一行 `<figure class="zoom">…</figure>`。
- **新增商品**：先在 Shopify 建立商品並在 Prodigi App 連結，再複製 `transient-serenity.html`（檔名＝商品 handle）改內容，並在 `shop.html` 加一張商品卡。
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
cart.html                購物車頁
404.html                 找不到頁面
css/style.css            全站樣式
js/main.js               導覽列、頁尾、地圖、瀑布流、燈箱、商品頁、購物車（Shopify）
js/config.js             Shopify 商店網址與公開金鑰、運費文字、多張折扣
images/                  照片（網頁版 2560px；sm/ 是縮圖；full/ 是點開放大用的高畫質版本）
```
