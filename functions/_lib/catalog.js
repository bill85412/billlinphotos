// Shop catalog used by the checkout and order functions.
// Prices live here, on the server, so a visitor cannot change them in the browser.
//
// Each product (the key is the product page's filename without .html, and its data-handle):
//   title      name shown on the PayPal checkout page and receipt
//   printFile  the high-resolution print file sent to Prodigi:
//                "r2:FILENAME"  → a file in the PRINT_FILES R2 bucket (served by /api/print-file)
//                "https://..."  → any other address Prodigi can download from
//   variants   one entry per option button on the product page.
//              The key must match the button's data-value, and the price its data-price.
//                price  in US cents (10000 = $100.00)
//                sku    Prodigi product code. Check every one in the Prodigi dashboard product catalog
//                       before going live; it decides the material and the print size.

export const CURRENCY = "USD";

// Flat shipping charged to the buyer per order, in cents. 0 = free shipping (cost built into the price).
export const SHIPPING = { amount: 0, label: "Free shipping" };

// Prodigi delivery speed for every order.
export const PRODIGI_SHIPPING_METHOD = "budget";

// Prints: one variant per Material × Size, keyed "Material / Size" (the product page joins the chosen buttons with " / ").
// Prices are starting points — check them against the Prodigi cost + shipping for each size before going live.
const SIZES = {
  "12 × 18 in": { canvas: 8000,  framed: 6500,  code: "12X18" },
  "16 × 24 in": { canvas: 10000, framed: 8000,  code: "16X24" },
  "24 × 36 in": { canvas: 16000, framed: 14000, code: "24X36" },
};
const PRINT = {};
for (const [size, s] of Object.entries(SIZES)) {
  PRINT[`Canvas Print / ${size}`] = { price: s.canvas, sku: `GLOBAL-CAN-${s.code}` };
  PRINT[`Framed Print / ${size}`] = { price: s.framed, sku: `GLOBAL-CFPM-${s.code}` };
}
// TODO before going live: replace with the real Prodigi postcard SKU from the Prodigi product catalog.
const POSTCARD = {
  "4 × 6 in": { price: 500, sku: "CHECK-PRODIGI-POSTCARD-SKU" },
};

export const PRODUCTS = {
  "transient-serenity":    { title: "“Transient Serenity”",    printFile: "r2:transient-serenity.jpg",    variants: PRINT },
  "boston-public-library": { title: "“Boston Public Library”", printFile: "r2:boston-public-library.jpg", variants: PRINT },
  "fenway-park":           { title: "“Fenway Park”",           printFile: "r2:fenway-park.jpg",           variants: PRINT },
  "tow-zone":              { title: "“Tow Zone”",              printFile: "r2:tow-zone.jpg",              variants: PRINT },
  "boston-public-library-postcard": { title: "“Boston Public Library” Postcard", printFile: "r2:boston-public-library.jpg", variants: POSTCARD },
  "fenway-park-postcard":           { title: "“Fenway Park” Postcard",           printFile: "r2:fenway-park.jpg",           variants: POSTCARD },
};

export function findVariant(slug, variant) {
  const product = Object.prototype.hasOwnProperty.call(PRODUCTS, slug) ? PRODUCTS[slug] : null;
  if (!product) return null;
  const v = Object.prototype.hasOwnProperty.call(product.variants, variant) ? product.variants[variant] : null;
  return v ? { product, variant: v } : null;
}
