// Shop catalog used by the checkout and order functions.
// Prices live here, on the server, so a visitor cannot change them in the browser.
//
// Each product:
//   title      name shown on the PayPal checkout page and receipt
//   printFile  the high-resolution print file sent to Prodigi:
//                "r2:FILENAME"  → a file in the PRINT_FILES R2 bucket (served by /api/print-file)
//                "https://..."  → any other address Prodigi can download from
//   variants   one entry per option in the product page's "Material" menu.
//              The key must match the <option value="..."> on the product page.
//                price  in US cents (10000 = $100.00)
//                sku    Prodigi product code. Check it in the Prodigi dashboard product catalog
//                       before going live; it decides the material and the print size.

export const CURRENCY = "USD";

// Flat shipping charged to the buyer, in cents. 0 = free shipping (cost built into the price).
export const SHIPPING = { amount: 0, label: "Free shipping" };

// Prodigi delivery speed for every order.
export const PRODIGI_SHIPPING_METHOD = "budget";

export const PRODUCTS = {
  "transient-serenity": {
    title: "“Transient Serenity”",
    printFile: "r2:transient-serenity.jpg",
    variants: {
      "Canvas Print": { price: 10000, sku: "GLOBAL-CAN-16X24" },
      "Framed Print": { price: 8000, sku: "GLOBAL-CFPM-16X24" },
    },
  },
};

export function findVariant(slug, variant) {
  const product = PRODUCTS[slug];
  if (!product) return null;
  const v = product.variants[variant];
  return v ? { product, variant: v } : null;
}
