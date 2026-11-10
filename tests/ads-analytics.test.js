import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/ads/analytics.js";

test("analytics requires authenticated user before querying data", async () => {
  const response = await onRequestGet({ request: new Request("https://example.test/api/ads/analytics"), env: {} });
  assert.equal(response.status, 503);
});
test("analytics validates campaign filter", async () => {
  const env = { DB: {} };
  const request = new Request("https://example.test/api/ads/analytics?campaignId=bad");
  const response = await onRequestGet({ request, env });
  assert.notEqual(response.status, 200);
});
