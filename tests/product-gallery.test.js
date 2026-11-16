import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/products/[id]/media.js";

const id = "123e4567-e89b-12d3-a456-426614174000";
function dbFor({ published = true, media = [{ id:"m1", contentType:"image/png" }] } = {}) {
  const queries = [];
  return { queries, prepare(sql) { queries.push(sql); return { bind() { return {
    async first() { return published ? { id } : null; },
    async all() { return { results:media }; }
  }; } }; } };
}
test("public product gallery returns images only for published products in active stores", async () => {
  const DB = dbFor();
  const response = await onRequestGet({ env:{ DB }, params:{ id } });
  const body = await response.json();
  assert.equal(response.status,200);
  assert.equal(body.media.length,1);
  assert.match(DB.queries[0], /p.status = 'published'/);
  assert.match(DB.queries[0], /s.status = 'active'/);
  assert.match(DB.queries[1], /ORDER BY pm.sort_order ASC/);
});
test("public product gallery hides drafts and suspended stores", async () => {
  const response = await onRequestGet({ env:{ DB:dbFor({ published:false }) }, params:{ id } });
  assert.equal(response.status,404);
});
test("public product gallery rejects malformed identifiers", async () => {
  const response = await onRequestGet({ env:{ DB:dbFor() }, params:{ id:"not-an-id" } });
  assert.equal(response.status,404);
});
