// Shop settings. Prices, product options, discounts and orders all live in Shopify;
// Prodigi's Shopify app prints and ships each order.
window.SITE_CONFIG = {
  shopify: {
    domain: "",   // the store's myshopify.com address, e.g. "billlin.myshopify.com"
    token: "",    // public Storefront API access token (Shopify admin → Headless channel); it is meant to be public
  },
  shippingNote: "Free shipping",   // shown in the cart; match the shipping rate set in Shopify
  bundleDiscount: null,            // e.g. [{ qty: 2, percent: 10 }, { qty: 3, percent: 20 }] — only after the same automatic discount exists in Shopify
};
