import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { onRequestGet } from "../functions/api/store/mine.js";

const user = { id:"seller-1", email:"seller@example.test", role:"user" };
const store = { id:"store-1", name:"Aria Shop", slug:"aria-shop", description:"Clothing", status:"active" };
const product = { id:"product-1", title:"Cotton shirt", category:"fashion", priceMinor:1250000, currency:"IRR", stockCount:4, status:"draft" };
const request = () => new Request("https://example.test/api/store/mine", { headers:{ Cookie:"houshyar_session=valid-session" } });

function dbFor({ authenticated = true, hasStore = true } = {}) {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      statements.push(sql);
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("SELECT users.id")) return authenticated ? user : null;
              if (sql.includes("FROM merchant_stores")) return hasStore ? store : null;
              return null;
            },
            async all() { return { results:[product] }; }
          };
        }
      };
    }
  };
}

test("seller dashboard requires an authenticated session", async () => {
  const DB = dbFor({ authenticated:false });
  const response = await onRequestGet({ request:request(), env:{ DB } });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "AUTH_REQUIRED");
  assert.equal(DB.statements.length, 1);
});

test("seller dashboard returns only the signed-in user's store and products", async () => {
  const DB = dbFor();
  const response = await onRequestGet({ request:request(), env:{ DB } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.store.id, "store-1");
  assert.equal(body.products[0].id, "product-1");
  assert.match(DB.statements[1], /WHERE user_id = \?/);
  assert.match(DB.statements[2], /WHERE p\.store_id = \?/);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("seller dashboard returns an empty state when the user has no store", async () => {
  const DB = dbFor({ hasStore:false });
  const response = await onRequestGet({ request:request(), env:{ DB } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.store, null);
  assert.deepEqual(body.products, []);
  assert.equal(DB.statements.length, 2);
});

test("seller dashboard fails closed without the marketplace database", async () => {
  const response = await onRequestGet({ request:request(), env:{} });
  assert.equal(response.status, 503);
});

test("marketplace UI is connected to home screen and uses authenticated store endpoints", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(main, /initMarketplace/);
  assert.match(main, /data-open-marketplace/);
  assert.match(ui, /\/api\/store\/products/);
  assert.match(ui, /\/api\/store\/mine/);
  assert.match(ui, /\/api\/store\/apply/);
  assert.match(ui, /\/api\/store\/products\/publish/);
  assert.match(ui, /order\.storeName/);
  assert.match(ui, /credentials:"same-origin"/);
});

test("local store discovery UI uses explicit geolocation consent and manual city search", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /marketplace-local-search/);
  assert.match(ui, /\/api\/stores\?/);
  assert.match(ui, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(ui, /localNeedArea/);
  assert.match(ui, /params\.set\("lat"/);
  assert.match(ui, /params\.set\("lon"/);
  assert.match(ui, /rel="noopener noreferrer"/);
  assert.match(ui, /tel:/);
  assert.match(ui, /localStock/);
});

test("seller dashboard exposes editable store discovery profile and explicit location capture", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  const mine = await readFile(new URL("../functions/api/store/mine.js", import.meta.url), "utf8");
  assert.match(ui, /data-store-profile/);
  assert.match(ui, /\/api\/store\/profile/);
  assert.match(ui, /offersDelivery:form\.elements\.offersDelivery\.checked/);
  assert.match(ui, /offersPickup:form\.elements\.offersPickup\.checked/);
  assert.match(ui, /data-store-location/);
  assert.match(ui, /form\.elements\.latitude\.value = String\(position\.coords\.latitude\)/);
  assert.match(mine, /public_address AS publicAddress/);
  assert.match(mine, /offers_delivery AS offersDelivery/);
  assert.match(mine, /contact_phone AS contactPhone/);
});

test("marketplace UI explains disabled payment and virtual try-on features", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /Product image saved to private store storage/);
  assert.match(ui, /تصویر محصول در فضای خصوصی فروشگاه ذخیره شد/);
  assert.match(ui, /AI virtual try-on is not active yet/);
  assert.match(ui, /پرو مجازی هوش مصنوعی هنوز فعال نیست/);
});

test("seller dashboard supports a private multi-image product gallery and deletion", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  const api = await readFile(new URL("../functions/api/store/products/media.js", import.meta.url), "utf8");
  assert.match(ui, /\/api\/store\/products\/media/);
  assert.match(ui, /multiple/);
  assert.match(ui, /data-delete-media/);
  assert.match(ui, /method:"DELETE"/);
  assert.match(ui, /mediaByProduct/);
  assert.match(api, /export async function onRequestGet/);
  assert.match(api, /WHERE p\.store_id = \?/);
});
test("seller dashboard exposes private product image upload with client-side size/type checks", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /data-product-media-upload/);
  assert.match(ui, /\/api\/store\/products\/media/);
  assert.match(ui, /image\/jpeg.*image\/png.*image\/webp/);
  assert.match(ui, /5 \* 1024 \* 1024/);
  assert.match(ui, /new FormData\(\)/);
});


test("buyer product cards expose an on-demand public multi-image gallery", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /data-product-gallery=/);
  assert.match(ui, /data-product-gallery-items=/);
  assert.match(ui, /\/api\/products\//);
  assert.match(ui, /galleryOpen/);
  assert.match(ui, /data-product-detail=/);
  assert.match(ui, /data-product-detail-panel=/);
  assert.match(ui, /data-detail-search=/);
  assert.match(ui, /detailStock/);
  assert.match(ui, /galleryLoading/);
  assert.match(ui, /galleryEmpty/);
  assert.match(ui, /stockAvailable/);
  assert.match(ui, /stockUnavailable/);
});


test("local store results expose expandable store profiles and map links without implying in-app checkout", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /data-local-store-details=/);
  assert.match(ui, /data-local-store-panel=/);
  assert.match(ui, /localStoreDetails/);
  assert.match(ui, /https:\/\/www\.google\.com\/maps\?q=/);
  assert.match(ui, /localMethods/);
  assert.match(ui, /localOrder/);
});


test("buyer marketplace exposes authenticated order request form and fulfillment choices", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /data-order-open=/);
  assert.match(ui, /data-order-form/);
  assert.match(ui, /orderAddressRequired/);
  assert.match(ui, /\/api\/orders/);
  assert.match(ui, /fulfillment/);
});


test("seller dashboard loads and renders incoming marketplace orders with guarded status actions", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /request\("\/api\/store\/orders"\)/);
  assert.match(ui, /data-order-status=/);
  assert.match(ui, /orderAccept/);
  assert.match(ui, /orderReject/);
  assert.match(ui, /orderComplete/);
});


test("buyer order history is reachable in Persian and English marketplace UI and renders lifecycle states", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  const api = await readFile(new URL("../functions/api/orders.js", import.meta.url), "utf8");
  assert.match(ui, /data-market-tab="buyer-orders"/);
  assert.match(ui, /data-market-view="buyer-orders"/);
  assert.match(ui, /buyerOrders:"سفارش‌های من"/);
  assert.match(ui, /buyerOrders:"My orders"/);
  assert.match(ui, /request\("\/api\/orders"\)/);
  assert.match(ui, /orderRequested/);
  assert.match(ui, /orderAccepted/);
  assert.match(ui, /orderRejected/);
  assert.match(ui, /orderCompleted/);
  assert.match(api, /WHERE o\.buyer_id = \?/);
  assert.match(api, /storeName/);
  assert.match(ui, /orderUpdatedAt/);
  assert.match(ui, /order\.storeName/);
});


test("buyer marketplace provides a same-store multi-item cart and submits the items API payload", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /data-cart-add=/);
  assert.match(ui, /data-cart-form/);
  assert.match(ui, /data-cart-quantity=/);
  assert.match(ui, /data-cart-remove=/);
  assert.match(ui, /cartStoreMismatch/);
  assert.match(ui, /cartQtyInvalid/);
  assert.match(ui, /items:Array/);
  assert.match(ui, /priceMinor:item\.priceMinor/);
  assert.match(ui, /cartPriceChanged/);
  assert.match(ui, /cartTotalInvalid/);
  assert.match(ui, /!offersDelivery && !offersPickup/);
  assert.match(ui, /priceMinor:item\.priceMinor/);
  assert.match(ui, /cartPriceChanged/);
  assert.match(ui, /!offersDelivery && !offersPickup/);
  assert.match(ui, /cart\.clear\(\)/);
});

test("buyer order history groups multiple product rows under one order", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /const grouped = new Map\(\)/);
  assert.match(ui, /order\.items\.map\(item => escape\(item\.title\)/);
  assert.match(ui, /money\(order\.totalMinor, locale\)/);
});


test("public product catalog supplies store and fulfillment metadata required by the cart", async () => {
  const api = await readFile(new URL("../functions/api/store/products.js", import.meta.url), "utf8");
  assert.match(api, /p\.store_id AS storeId/);
  assert.match(api, /s\.offers_delivery AS offersDelivery/);
  assert.match(api, /s\.offers_pickup AS offersPickup/);
});


test("seller dashboard groups multi-item order lines under one status action", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /const groupedOrders = new Map\(\)/);
  assert.match(ui, /groupedOrders\.size \? Array\.from\(groupedOrders\.values\(\)\)/);
  assert.match(ui, /order\.items\.map\(item => escape\(item\.title\)/);
  assert.match(ui, /data-order-status="accepted"/);
});


test("multi-item order payload confirms the displayed product price and server rejects stale prices", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  const api = await readFile(new URL("../functions/api/orders.js", import.meta.url), "utf8");
  assert.match(ui, /priceMinor:item\.priceMinor/);
  assert.match(api, /requiresPriceConfirmation/);
  assert.match(api, /ORDER_PRICE_CHANGED/);
  assert.match(api, /Number\(product\.priceMinor\) !== item\.expectedPriceMinor/);
});


test("multi-item order payload confirms the displayed product price and server rejects stale prices", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  const api = await readFile(new URL("../functions/api/orders.js", import.meta.url), "utf8");
  assert.match(ui, /priceMinor:item\.priceMinor/);
  assert.match(api, /requiresPriceConfirmation/);
  assert.match(api, /ORDER_PRICE_CHANGED/);
  assert.match(api, /Number\(product\.priceMinor\) !== item\.expectedPriceMinor/);
});

test("buyer cart styling is responsive and confirmation remains visible after submission", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/style.css", import.meta.url), "utf8");
  assert.match(ui, /renderCart\(\); say\(c\.orderCreated\)/);
  assert.match(css, /\.marketplace-cart-row/);
  assert.match(css, /@media\(max-width:560px\)/);
});


test("local discovery order form preserves the store fulfillment options", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /localPanel\.innerHTML = orderFormMarkup\(productId, catalogProducts\.get\(productId\) \|\| null\)/);
  assert.match(ui, /const delivery = product\?\.offersDelivery !== false && product\?\.offersDelivery !== 0/);
  assert.match(ui, /const pickup = product\?\.offersPickup !== false && product\?\.offersPickup !== 0/);
});


test("marketplace refreshes active order tabs and announces newly received or changed orders", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /newOrderNotice/);
  assert.match(ui, /orderChangedNotice/);
  assert.match(ui, /notifyOrderChanges\("seller", orders\)/);
  assert.match(ui, /notifyOrderChanges\("buyer", orders\)/);
  assert.match(ui, /setInterval\(\(\) => \{/);
  assert.match(ui, /30000\)/);
  assert.match(ui, /clearInterval\(orderPollTimer\)/);
  assert.match(ui, /loadSeller\(\{ silent:true \}\)/);
  assert.match(ui, /loadBuyerOrders\(\{ silent:true \}\)/);
  assert.match(ui, /role="status" aria-live="polite"/);
});
