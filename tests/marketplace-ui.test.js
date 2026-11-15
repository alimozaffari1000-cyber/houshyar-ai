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
  assert.match(DB.statements[2], /WHERE store_id = \?/);
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
  assert.match(ui, /escape\(product\.title\)/);
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
  assert.match(ui, /Product image uploads require the private store storage binding/);
  assert.match(ui, /بارگذاری تصویر محصول پس از اتصال فضای ذخیره‌سازی امن فروشگاه فعال می‌شود/);
});

test("seller dashboard exposes private product image upload with client-side size/type checks", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /data-product-media-upload/);
  assert.match(ui, /\/api\/store\/products\/media/);
  assert.match(ui, /image\/jpeg.*image\/png.*image\/webp/);
  assert.match(ui, /5 \* 1024 \* 1024/);
  assert.match(ui, /new FormData\(\)/);
});
