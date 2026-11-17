import test from "node:test";
import assert from "node:assert/strict";
import { rankProviders } from "../functions/api/_lib/provider-evaluator.js";

const candidates = [
  { provider: "groq", available: true, latencyMs: 350, qualityScore: 82, successRate: 0.98, costPer1kTokens: 0.0005 },
  { provider: "anthropic", available: true, latencyMs: 900, qualityScore: 96, successRate: 0.995, costPer1kTokens: 0.008 },
  { provider: "google", available: true, latencyMs: 500, qualityScore: 89, successRate: 0.99, costPer1kTokens: 0.001 }
];

test("speed mode prioritizes low latency while quality mode values benchmark quality", () => {
  assert.equal(rankProviders(candidates, { mode: "speed" }).selected, "groq");
  assert.equal(rankProviders(candidates, { mode: "quality" }).selected, "anthropic");
});

test("economy mode considers observed cost", () => {
  assert.equal(rankProviders(candidates, { mode: "economy" }).selected, "groq");
});

test("explicit user selection is never silently replaced", () => {
  const result = rankProviders(candidates, { requestedProvider: "anthropic", mode: "speed" });
  assert.equal(result.selected, "anthropic");
  assert.equal(result.reason, "explicit_user_selection");
  const unavailable = rankProviders(candidates, { requestedProvider: "google", mode: "quality" });
  assert.equal(unavailable.selected, "google");
});

test("unavailable, malformed and unsupported candidates are ignored", () => {
  const result = rankProviders([
    ...candidates,
    { provider: "openai", available: true, latencyMs: 1, qualityScore: 100, successRate: 1, costPer1kTokens: 0 },
    { provider: "groq", available: false, latencyMs: 1 }
  ]);
  assert.equal(result.ranked.length, 3);
  assert.equal(rankProviders([], {}).selected, null);
  assert.equal(rankProviders(candidates, { requestedProvider: "openai" }).selected, null);
});

test("missing measurements are excluded from scoring without creating NaN", () => {
  const result = rankProviders([{ provider: "groq", available: true }]);
  assert.equal(result.selected, "groq");
  assert.equal(Number.isFinite(result.ranked[0].score), true);
});
