import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/product-media/[id].js";

const ID = "123e4567-e89b-12d3-a456-426614174000";
function envFor(media) {
  let reads = 0;
  return {
    env: {
      DB: { prepare(sql) { return { bind() { return { async first() { return sql.includes("SELECT pm.object_key") ? media : null; } }; } }; } },
      MEDIA_BUCKET: { async get(key) { reads += 1; return key === "products/p1/m1" ? { body: new Blob(["image-bytes"]).stream(), size: 11, httpEtag: '"abc"', httpMetadata: { contentType: "image/png" } } : null; } }
    },
    reads: () => reads
  };
}
const published = { objectKey: "products/p1/m1", contentType: "image/png", width: 2, height: 3, productStatus: "published", storeStatus: "active", storeOwner: "seller-1" };

test("published product media streams from private R2 with safe headers", async () => {
  const setup = envFor(published);
  const response = await onRequestGet({ request: new Request("https://example.test/api/product-media/" + ID), env: setup.env, params: { id: ID } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("cache-control"), /public/);
  assert.equal(await response.text(), "image-bytes");
  assert.equal(setup.reads(), 1);
});

test("draft product media is not disclosed to anonymous visitors", async () => {
  const setup = envFor({ ...published, productStatus: "draft" });
  const response = await onRequestGet({ request: new Request("https://example.test/api/product-media/" + ID), env: setup.env, params: { id: ID } });
  assert.equal(response.status, 404);
  assert.equal(setup.reads(), 0);
});

test("unknown and invalid media IDs fail closed", async () => {
  const setup = envFor(published);
  const response = await onRequestGet({ request: new Request("https://example.test/api/product-media/not-an-id"), env: setup.env, params: { id: "not-an-id" } });
  assert.equal(response.status, 404);
  assert.equal(setup.reads(), 0);
});

test("private storage is required", async () => {
  const response = await onRequestGet({ request: new Request("https://example.test"), env: { DB: {} }, params: { id: ID } });
  assert.equal(response.status, 503);
});
