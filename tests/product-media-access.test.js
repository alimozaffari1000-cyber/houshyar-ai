import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/product-media/[id].js";

const mediaId = "123e4567-e89b-12d3-a456-426614174000";
const ownerId = "seller-1";

function envFor({ productStatus = "published", storeStatus = "active", storeOwner = ownerId } = {}) {
  const object = new Response("image-bytes");
  return {
    MEDIA_BUCKET: {
      async get(key) {
        assert.equal(key, "products/p1/media1");
        return { body: object.body, size: 11, httpEtag: '"test-etag"' };
      }
    },
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            if (sql.includes("FROM product_media")) {
              assert.deepEqual(values, [mediaId]);
              return { async first() {
                return { objectKey: "products/p1/media1", contentType: "image/png", width: 2, height: 3, productStatus, storeStatus, storeOwner };
              } };
            }
            if (sql.includes("FROM sessions JOIN users")) {
              return { async first() {
                return values[0] === "valid-token-hash" ? { id: ownerId, email: "seller@example.test", role: "user" } : null;
              } };
            }
            throw new Error("Unexpected query: " + sql);
          }
        };
      }
    }
  };
}

test("published product media is publicly readable without a session", async () => {
  const response = await onRequestGet({
    request: new Request("https://example.test/api/product-media/" + mediaId),
    env: envFor(),
    params: { id: mediaId }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=60");
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; sandbox");
});

test("unpublished product media is not disclosed to anonymous users", async () => {
  const response = await onRequestGet({
    request: new Request("https://example.test/api/product-media/" + mediaId),
    env: envFor({ productStatus: "draft" }),
    params: { id: mediaId }
  });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("unpublished product media is readable by its owning seller only", async () => {
  const token = "valid-session-token";
  const tokenHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), b => b.toString(16).padStart(2, "0")).join("");
  const env = envFor({ productStatus: "draft" });
  const originalPrepare = env.DB.prepare;
  env.DB.prepare = sql => {
    const statement = originalPrepare(sql);
    if (sql.includes("FROM sessions JOIN users")) return { bind: (...values) => ({ async first() { return values[0] === tokenHash ? { id: ownerId, email: "seller@example.test", role: "user" } : null; } }) };
    return statement;
  };
  const response = await onRequestGet({
    request: new Request("https://example.test/api/product-media/" + mediaId, { headers: { Cookie: "houshyar_session=" + token } }),
    env,
    params: { id: mediaId }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("media endpoint rejects malformed identifiers before database access", async () => {
  const response = await onRequestGet({
    request: new Request("https://example.test/api/product-media/not-a-uuid"),
    env: { DB: { prepare() { throw new Error("must not query"); } }, MEDIA_BUCKET: {} },
    params: { id: "not-a-uuid" }
  });
  assert.equal(response.status, 404);
});
