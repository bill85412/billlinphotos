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
export const PRODIGI_SHIPPING_METHOD = "standard"; // tracked (owner's choice); "budget" may ship without tracking

// Prints: one variant per Material × Size, keyed "Material / Size" (the product page joins the chosen buttons with " / ").
// SKUs are the ones the owner set up in the Prodigi dashboard ("Your products" → BPL in Early Morning Canvas / Framed):
//   Canvas  = Slim canvas, 19 mm bar, standard 400gsm canvas, image wrap
//   Framed  = Classic frame, black, EMA paper, Snow white 1.4 mm mount, acrylic glaze (Prodigi sizes are metric: 30×45, 40×60 cm)
// Costs in Prodigi (before shipping): canvas $29.28 / $30.00 / $52.00, framed $101.70 / $119.10.
//   attributes  sent to Prodigi with the item (exact names/values to confirm with the first sandbox order)
//   sizing      "fillPrintArea" fills the print area (canvas); "fitPrintArea" never crops the photo (framed, inside the mount)
const CANVAS_ATTR = { wrap: "ImageWrap" };
const FRAME_ATTR = { color: "black", mountColor: "snow white" };
const SIZES = {
  "12 × 18 in": { canvas: 8000,  framed: 25000, canvasSku: "CAN-19MM-SC-12X18",    frameSku: "FRA-CLA-EMA-MOUNT1-ACRY-30X45" },
  "16 × 24 in": { canvas: 10000, framed: 30000, canvasSku: "GLOBAL-SLIMCAN-16X24", frameSku: "FRA-CLA-EMA-MOUNT1-ACRY-40X60" },
  "24 × 36 in": { canvas: 16000, framed: null,  canvasSku: "GLOBAL-SLIMCAN-24X36" },  // no framed 24 × 36 (owner's choice)
};
const PRINT = {};
for (const [size, s] of Object.entries(SIZES)) {
  PRINT[`Canvas / ${size}`] = { price: s.canvas, sku: s.canvasSku, attributes: CANVAS_ATTR, sizing: "fillPrintArea" };
  if (s.framed) PRINT[`Framed Print / ${size}`] = { price: s.framed, sku: s.frameSku, attributes: FRAME_ATTR, sizing: "fitPrintArea" };
}
// Fine art postcard, 6×4" Mohawk 324gsm matte, single, blank back (Prodigi catalogue, cost $0.88 before shipping).
const POSTCARD = {
  "4 × 6 in": { price: 500, sku: "GLOBAL-POST-MOH-6X4-BLA", sizing: "fillPrintArea" },
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
