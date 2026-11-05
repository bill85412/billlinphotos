# Bill Lin Photography — 自管網站

從 Squarespace 原站複製的靜態網站，純 HTML / CSS / JavaScript，不需要任何後台。照片都已經放在 `images/` 裡。

## 預覽

直接雙擊 `index.html`，就能在瀏覽器裡看。

## 上線（免費）

**Cloudflare Pages**（推薦）或 **Netlify**：登入後選「上傳資料夾 / Deploy manually」，把整個網站資料夾拖進去就完成了。
之後在主機的設定裡綁上你的網域（例如 billlinphoto.com），再到網域商把 DNS 指過去。

## 商店付款：`js/config.js`

找到商家後，把每個規格的付款連結（例如 Stripe Payment Link）填進 `stripeLinks`。
留空的時候，按「Add To Cart」會顯示「Online ordering is coming soon.」

## 常見修改

- **換文字**：用文字編輯器打開對應的 `.html` 直接改。
- **加照片到相簿**：照片放進 `images/`，在 `gallery.html` 或 `boston.html` 裡複製一行
  `<figure class="zoom"><img src="images/檔名.jpg" alt="描述"></figure>`。
- **新增商品**：複製一份 `transient-serenity.html` 改內容，再到 `shop.html` 加一張商品卡。
- **選單、IG / YouTube 連結**：在 `js/main.js` 最上面。

## 檔案結構

```
index.html               首頁
about.html               About
gallery.html             Gallery（世界地圖、瀑布流、Autumn in Boston、New York City）
boston.html              Boston 相簿
blog.html                Blog 列表
autumn-in-boston.html    文章
shop.html                商店
transient-serenity.html  商品頁
404.html                 找不到頁面
css/style.css            全站樣式
js/main.js               導覽列、頁尾、瀑布流、燈箱、商店
js/config.js             付款連結設定
images/                  照片（網頁版 2560px；sm/ 是縮圖；full/ 是點開放大用的高畫質版本）
```

## 和原站的差異

- 標題字體原本是 Adobe 付費字型 Orpheus Pro，改用風格接近的免費字型 Cormorant Garamond。
- 拿掉了 Contact 頁，選單多了 YouTube 圖示。
- 商店的結帳改用付款連結，目前還沒設定。
