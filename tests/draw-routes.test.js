import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet as campaignsGet } from "../functions/api/draws/campaigns.js";
import { onRequestPost as entriesPost } from "../functions/api/draws/entries.js";
import { onRequestPost as adminCampaignPost } from "../functions/api/draws/admin/campaigns.js";
import { onRequestPost as adminReviewPost } from "../functions/api/draws/admin/review.js";
import { onRequestPost as adminExecutePost } from "../functions/api/draws/admin/execute.js";
import { onRequestPost as adminVerifyPost } from "../functions/api/draws/admin/verify.js";
import { onRequestGet as resultsGet } from "../functions/api/draws/results.js";

const req = (path, method = "GET", body) => new Request("https://example.test" + path, {
  method,
  headers: body ? { "Content-Type": "application/json", Origin: "https://example.test" } : {},
  ...(body ? { body: JSON.stringify(body) } : {})
});

test("draw APIs fail closed when draw feature flag is disabled", async () => {
  const env = { DRAW_MODULE_ENABLED: "false" };
  const responses = await Promise.all([
    campaignsGet({ request: req("/api/draws/campaigns"), env }),
    entriesPost({ request: req("/api/draws/entries", "POST", {}), env }),
    adminCampaignPost({ request: req("/api/draws/admin/campaigns", "POST", {}), env }),
    adminReviewPost({ request: req("/api/draws/admin/review", "POST", {}), env }),
    adminExecutePost({ request: req("/api/draws/admin/execute", "POST", {}), env }),
    adminVerifyPost({ request: req("/api/draws/admin/verify", "POST", {}), env }),
    resultsGet({ request: req("/api/draws/results?campaignId=00000000-0000-4000-8000-000000000000"), env })
  ]);
  for (const response of responses) {
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /DRAWS_NOT_CONFIGURED/);
  }
});

test("draw entry and admin APIs require authentication when enabled", async () => {
  const env = { DRAW_MODULE_ENABLED: "true", AUTH_ENABLED: "true", DB: {} };
  const responses = await Promise.all([
    entriesPost({ request: req("/api/draws/entries", "POST", { campaignId: "00000000-0000-4000-8000-000000000000" }), env }),
    adminCampaignPost({ request: req("/api/draws/admin/campaigns", "POST", { title: "Demo", prizeDescription: "Prize" }), env }),
    adminReviewPost({ request: req("/api/draws/admin/review", "POST", { campaignId: "00000000-0000-4000-8000-000000000000", action: "open" }), env }),
    adminExecutePost({ request: req("/api/draws/admin/execute", "POST", { campaignId: "00000000-0000-4000-8000-000000000000" }), env }),
    adminVerifyPost({ request: req("/api/draws/admin/verify", "POST", { campaignId: "00000000-0000-4000-8000-000000000000" }), env })
  ]);
  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "AUTH_REQUIRED");
  }
});
