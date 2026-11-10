import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeEligibleEntries, selectDrawWinner, summarizeDraw } from "../src/draw/draw-engine.js";

test("eligible entries are filtered, deduplicated and sorted deterministically", () => {
  const entries = [
    { id: "b", ticket_code: "B" },
    { id: "a", ticket_code: "A" },
    { id: "a", ticket_code: "A2" },
    { id: "x", entry_status: "void" },
    { id: "", ticket_code: "bad" }
  ];
  assert.deepEqual(normalizeEligibleEntries(entries).map(item => item.id), ["a", "b"]);
  assert.deepEqual(summarizeDraw(entries), {
    totalEntries: 5, eligibleEntries: 2, uniqueEligibleParticipants: 2
  });
});

test("winner selection is uniform-range safe and deterministic with injected RNG", () => {
  const entries = [{ id: "c" }, { id: "a" }, { id: "b" }];
  assert.equal(selectDrawWinner(entries, () => 0).id, "a");
  assert.equal(selectDrawWinner(entries, () => 1).id, "b");
  assert.equal(selectDrawWinner(entries, () => 2).id, "c");
});

test("winner selection rejects biased tail values and retries", () => {
  let calls = 0;
  const winner = selectDrawWinner([{ id: "a" }, { id: "b" }, { id: "c" }], () => {
    calls += 1;
    return calls === 1 ? 0xffffffff : 4;
  });
  assert.equal(calls, 2);
  assert.equal(winner.id, "b");
});

test("winner selection fails closed without secure random source or eligible entries", () => {
  assert.throws(() => selectDrawWinner([{ id: "a" }]), /SECURE_RANDOM_SOURCE_REQUIRED/);
  assert.throws(() => selectDrawWinner([{ id: "a", entry_status: "void" }], () => 0), /NO_ELIGIBLE_ENTRIES/);
  assert.throws(() => selectDrawWinner([{ id: "a" }], () => -1), /INVALID_RANDOM_UINT32/);
});

test("draw migration permanently disables paid entry and protects results and audit records", () => {
  const sql = readFileSync("migrations/0008_promotional_draws.sql", "utf8");
  assert.match(sql, /paid_entry_enabled INTEGER NOT NULL DEFAULT 0 CHECK \(paid_entry_enabled = 0\)/);
  assert.match(sql, /UNIQUE \(campaign_id, user_id, id\)/);
  assert.match(sql, /UNIQUE \(campaign_id, ticket_code\)/);
  assert.match(sql, /campaign_id TEXT NOT NULL UNIQUE/);
  assert.match(sql, /trg_draw_results_no_update/);
  assert.match(sql, /trg_draw_audit_no_delete/);
});
