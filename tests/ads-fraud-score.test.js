import test from "node:test";
import assert from "node:assert/strict";
import { scoreAdEvent } from "../src/ads/fraud-score.js";

test("normal impression and click start with conservative review score", () => {
  assert.deepEqual(scoreAdEvent({ eventType: "impression" }), { riskScore: 20, reasons: [] });
  assert.deepEqual(scoreAdEvent({ eventType: "click", hasValidImpression: true }), { riskScore: 20, reasons: [] });
});
test("rapid repeated events are flagged for manual review", () => {
  const result = scoreAdEvent({ eventType: "impression", recentSameTypeCount: 5 });
  assert.equal(result.riskScore, 65);
  assert.deepEqual(result.reasons, ["repeated_same_type_events_10m"]);
});
test("clicks without a validated impression receive elevated risk", () => {
  const result = scoreAdEvent({ eventType: "click", hasValidImpression: false });
  assert.equal(result.riskScore, 55);
  assert.deepEqual(result.reasons, ["click_without_valid_impression"]);
});
test("risk score is capped and invalid inputs rejected", () => {
  assert.equal(scoreAdEvent({ eventType: "click", recentSameTypeCount: 5, hasValidImpression: false }).riskScore, 100);
  assert.throws(() => scoreAdEvent({ eventType: "conversion" }), /INVALID_AD_EVENT_TYPE/);
  assert.throws(() => scoreAdEvent({ eventType: "click", recentSameTypeCount: -1 }), /INVALID_EVENT_COUNT/);
});
