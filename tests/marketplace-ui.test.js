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
  assert.match(ui, /\/api\/stores/);
  assert.match(ui, /\/api\/store\/mine/);
  assert.match(ui, /\/api\/store\/apply/);
  assert.match(ui, /\/api\/store\/products\/publish/);
  assert.match(ui, /escape\(product\.title\)/);
  assert.match(ui, /credentials:"same-origin"/);
  assert.match(ui, /navigator\.geolocation/);
  assert.match(ui, /data-market-near/);
  assert.match(ui, /params\.set\("mode"/);
  assert.match(ui, /data-order-create/);
  assert.match(ui, /stockAvailable/);
  assert.match(ui, /outOfStock/);
  assert.match(ui, /modes && stockAvailable/);
  assert.match(ui, /marketplace-stock/);
  assert.match(ui, /data-market-tab="orders"/);
  assert.match(ui, /\/api\/store\/orders/);
});

test("marketplace UI explains disabled payment and virtual try-on features", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /Orders are requests to sellers in this version/);
  assert.match(ui, /ثبت سفارش در این مرحله درخواست به فروشنده است/);
});


test("marketplace parses Persian shopping requests into bounded item terms", async () => {
  const ui = await readFile(new URL("../src/marketplace.js", import.meta.url), "utf8");
  assert.match(ui, /const shoppingTerms = value =>/);
  assert.match(ui, /params\.append\("item", term\)/);
  assert.match(ui, /slice\(0, 10\)/);
  assert.match(ui, /normalize\("NFKC"\)/);
});

test("multi-item result summary groups matches, reports missing items, and ranks stores by coverage", async () => {
  const { summarizeShoppingResults } = await import("../src/marketplace.js");
  const terms = ["سیب", "شیر", "نان"];
  const products = [
    { storeId:"a", storeName:"فروشگاه الف", title:"سیب", matchedTerms:["سیب"] },
    { storeId:"a", storeName:"فروشگاه الف", title:"شیر", matchedTerms:["شیر"] },
    { storeId:"b", storeName:"فروشگاه ب", title:"سیب", matchedTerms:["سیب"] }
  ];
  const result = summarizeShoppingResults(terms, products);
  assert.deepEqual(result.itemGroups.map(group => group.products.length), [2, 1, 0]);
  assert.deepEqual(result.missingTerms, ["نان"]);
  assert.equal(result.storeCoverage[0].storeName, "فروشگاه الف");
  assert.equal(result.storeCoverage[0].itemCount, 2);
});

test("multi-item baskets prefer complete nearby stores and calculate totals only in one currency", async () => {
  const { summarizeShoppingResults } = await import("../src/marketplace.js");
  const terms = ["apple", "milk"];
  const products = [
    { productId:"far-apple", storeId:"far", storeName:"Far Shop", matchedTerms:["apple", "milk"], stockCount:2, priceMinor:100, currency:"IRR", distanceKm:8 },
    { productId:"far-milk", storeId:"far", storeName:"Far Shop", matchedTerms:["milk"], stockCount:2, priceMinor:200, currency:"IRR", distanceKm:8 },
    { productId:"near-apple", storeId:"near", storeName:"Near Shop", matchedTerms:["apple"], stockCount:2, priceMinor:80, currency:"IRR", distanceKm:1 },
    { productId:"near-milk", storeId:"near", storeName:"Near Shop", matchedTerms:["milk"], stockCount:2, priceMinor:120, currency:"IRR", distanceKm:1 }
  ];
  const result = summarizeShoppingResults(terms, products);
  assert.equal(result.completeStores[0].storeName, "Near Shop");
  assert.equal(result.completeStores[0].basketTotal, 200);
  assert.equal(result.completeStores[0].distanceKm, 1);
  const mixed = summarizeShoppingResults(terms, [{...products[2]}, {...products[3], currency:"USD"}]);
  assert.equal(mixed.completeStores[0].basketTotal, null);
});
