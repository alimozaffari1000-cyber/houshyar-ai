import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost, onRequestDelete } from "../functions/api/store/products/media.js";

const imagePng = () => {
  const bytes = new Uint8Array(24);
  bytes.set([137,80,78,71,13,10,26,10]);
  new DataView(bytes.buffer).setUint32(16, 2);
  new DataView(bytes.buffer).setUint32(20, 3);
  return bytes;
};
const request = (url, file, cookie = "houshyar_session=session") => {
  const body = new FormData();
  body.set("productId", "123e4567-e89b-12d3-a456-426614174000");
  if (file) body.set("file", file);
  return new Request(url, { method: "POST", headers: { Origin: "https://example.test", Cookie: cookie }, body });
};
function dbFor({ product = { id: "p1" }, media = null, onRun = () => {} } = {}) {
  return { prepare(sql) { return { bind(...values) { return {
    async first() {
      if (sql.includes("SELECT users.id")) return { id: "u1", email: "seller@example.test", role: "user" };
      if (sql.includes("INSERT INTO api_rate_limits")) return { request_count: 1 };
      if (sql.includes("SELECT id, status FROM merchant_stores")) return { id: "s1", status: "active" };
      if (sql.includes("SELECT id FROM products")) return product;
      if (sql.includes("SELECT pm.id")) return media;
      return null;
    },
    async run() { onRun(sql, values); return { meta: { changes: 1 } }; }
  }; } }; } };
}
test("media upload fails closed without private R2 binding", async () => {
  const response = await onRequestPost({ request: request("https://example.test/api/store/products/media", null), env: { DB: dbFor() } });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "MEDIA_STORAGE_NOT_CONFIGURED");
});
test("media upload requires authentication", async () => {
  const response = await onRequestPost({ request: request("https://example.test/api/store/products/media", null, ""), env: { DB: { prepare() { throw new Error("must not query"); } }, MEDIA_BUCKET: {} } });
  assert.equal(response.status, 401);
});
test("media upload rejects cross-origin request before reading upload", async () => {
  const response = await onRequestPost({ request: new Request("https://example.test/api/store/products/media", { method:"POST", headers:{Origin:"https://evil.example"} }), env:{DB:{prepare(){throw new Error("must reject");}},MEDIA_BUCKET:{}} });
  assert.equal(response.status,403);
});
test("media upload validates actual image signature, size and product ownership", async () => {
  let stored = 0, inserted = 0;
  const bucket = { async put() { stored += 1; }, async delete() {} };
  const file = new File([imagePng()], "room.png", { type: "image/png" });
  const response = await onRequestPost({ request: request("https://example.test/api/store/products/media", file), env: { DB: dbFor({onRun:sql=>{if(sql.includes("INSERT INTO product_media")) inserted += 1;}}), MEDIA_BUCKET: bucket } });
  const body = await response.json();
  assert.equal(response.status,201);
  assert.equal(body.media.width,2);
  assert.equal(body.media.height,3);
  assert.equal(stored,1);
  assert.equal(inserted,1);
});
test("media upload rejects spoofed image MIME type", async () => {
  const file = new File(["not really an image"], "fake.png", { type: "image/png" });
  const response = await onRequestPost({ request: request("https://example.test/api/store/products/media", file), env: { DB: dbFor(), MEDIA_BUCKET: { async put(){throw new Error("must not store");} } } });
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,"INVALID_IMAGE_SIGNATURE");
});
test("media upload enforces product ownership", async () => {
  const file = new File([imagePng()], "x.png", { type: "image/png" });
  const response = await onRequestPost({ request: request("https://example.test/api/store/products/media", file), env: { DB: dbFor({product:null}), MEDIA_BUCKET:{async put(){throw new Error("must not store");}} } });
  assert.equal(response.status,404);
});
test("media delete requires authentication", async () => {
  const response = await onRequestDelete({ request: new Request("https://example.test/api/store/products/media", {method:"DELETE",headers:{Origin:"https://example.test","Content-Type":"application/json"},body:JSON.stringify({mediaId:"123e4567-e89b-12d3-a456-426614174000"})}), env:{DB:{prepare(){throw new Error("must not query");}},MEDIA_BUCKET:{}} });
  assert.equal(response.status,401);
});

test("media upload removes the R2 object if D1 metadata write fails", async () => {
  let deleted = 0;
  const db = dbFor();
  const originalPrepare = db.prepare;
  db.prepare = sql => {
    const statement = originalPrepare(sql);
    if (sql.includes("INSERT INTO product_media")) return { bind() { return { async run() { throw new Error("D1 unavailable"); } }; } };
    return statement;
  };
  const file = new File([imagePng()], "room.png", { type: "image/png" });
  const response = await onRequestPost({ request: request("https://example.test/api/store/products/media", file), env: { DB: db, MEDIA_BUCKET: { async put() {}, async delete() { deleted += 1; } } } });
  assert.equal(response.status,503);
  assert.equal(deleted,1);
});
test("media migration defines private object metadata without public URLs", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile(new URL("../migrations/0005_visual_try_on_foundation.sql", import.meta.url), "utf8");
  assert.match(migration,/CREATE TABLE IF NOT EXISTS product_media/);
  assert.match(migration,/object_key TEXT NOT NULL UNIQUE/);
  assert.match(migration,/content_type/);
  assert.doesNotMatch(migration,/public_url|https?:/i);
});

test("media gallery listing is private and scoped to the signed-in seller", async () => {
  const queries = [];
  const DB = { prepare(sql) { queries.push(sql); return { bind() { return {
    async first() {
      if (sql.includes("SELECT users.id")) return { id:"u1", email:"seller@example.test", role:"user" };
      if (sql.includes("SELECT id FROM merchant_stores")) return { id:"s1" };
      return null;
    },
    async all() { return { results:[{ id:"m1", productId:"p1", contentType:"image/png" }] }; }
  }; } }; } };
  const response = await onRequestGet({ request:new Request("https://example.test/api/store/products/media", { headers:{Cookie:"houshyar_session=session"} }), env:{DB} });
  const body = await response.json();
  assert.equal(response.status,200);
  assert.equal(body.media.length,1);
  assert.equal(body.media[0].id,"m1");
  assert.match(queries[2], /WHERE p\.store_id = \?/);
});
test("media gallery listing requires authentication", async () => {
  const response = await onRequestGet({ request:new Request("https://example.test/api/store/products/media"), env:{DB:{prepare(){throw new Error("must not query");}}} });
  assert.equal(response.status,401);
});
