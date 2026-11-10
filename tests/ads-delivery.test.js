import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/ads/placements.js";

const request = slot => new Request("https://example.test/api/ads/placements?slot=" + encodeURIComponent(slot));

test("public delivery remains disabled unless both flags are enabled", async () => {
  const response = await onRequestGet({ request: request("home_below_welcome"), env: { ADS_MARKETPLACE_ENABLED: "true", ADS_PUBLIC_DELIVERY_ENABLED: "false" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ads: [], enabled: false });
});

test("placement key is validated before database access", async () => {
  const response = await onRequestGet({ request: request("../campaigns"), env: { ADS_MARKETPLACE_ENABLED: "true", ADS_PUBLIC_DELIVERY_ENABLED: "true", DB: {} } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_AD_SLOT");
});

test("valid placement returns empty when slot is not enabled", async () => {
  const db = { prepare() { return { bind() { return { async first() { return null; } }; } }; } };
  const response = await onRequestGet({ request: request("home_below_welcome"), env: { ADS_MARKETPLACE_ENABLED: "true", ADS_PUBLIC_DELIVERY_ENABLED: "true", DB: db } });
  assert.deepEqual(await response.json(), { ads: [], enabled: true });
});

test("approved barter campaigns can be delivered without a cash budget", async () => {
  const statements = [];
  const db = {
    prepare(sql) {
      statements.push(sql);
      return {
        bind() {
          if (sql.includes("FROM ad_slots")) return { async first() { return { max_items: 2 }; } };
          return { async all() {
            return { results: [{
              id: "barter-1",
              title: "همکاری با پلتفرم همکار",
              creative_payload: JSON.stringify({ description: "معرفی متقابل خدمات" }),
              destination_url: "https://partner.example/offer",
              pricing_model: "barter"
            }] };
          } };
        }
      };
    }
  };
  const response = await onRequestGet({
    request: request("home_below_welcome"),
    env: { ADS_MARKETPLACE_ENABLED: "true", ADS_PUBLIC_DELIVERY_ENABLED: "true", DB: db }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(statements[1], /budget_minor > 0 OR pricing_model = 'barter'/);
  assert.equal(body.ads.length, 1);
  assert.equal(body.ads[0].pricingModel, "barter");
  assert.equal(body.ads[0].label, "تبادل تبلیغاتی");
});
