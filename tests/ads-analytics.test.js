import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/ads/analytics.js";

test("analytics fails closed until the marketplace is enabled", async () => {
  const response = await onRequestGet({
    request: new Request("https://example.test/api/ads/analytics"),
    env: { ADS_MARKETPLACE_ENABLED: "false" }
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "ADS_NOT_CONFIGURED");
});
