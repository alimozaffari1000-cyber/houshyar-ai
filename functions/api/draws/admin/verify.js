import { requireDrawUser, checkDrawRate, adJson, readAdsJson } from "../../_lib/draws.js";
import { selectDrawWinner } from "../../../../src/draw/draw-engine.js";

const fromHex = value => {
  if (typeof value !== "string" || !/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("INVALID_HEX");
  return new Uint8Array(value.match(/.{2}/g).map(pair => parseInt(pair, 16)));
};
const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
async function sha256(bytes) { return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)); }
async function buildWords(seed, count = 128) {
  const words = [];
  for (let counter = 0; words.length < count; counter += 1) {
    const input = new Uint8Array(seed.length + 4);
    input.set(seed);
    new DataView(input.buffer).setUint32(seed.length, counter, false);
    const block = await sha256(input);
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
    for (let offset = 0; offset < block.length && words.length < count; offset += 4) words.push(view.getUint32(offset, false));
  }
  return words;
}

export async function onRequestPost({ request, env }) {
  const auth = await requireDrawUser({ request, env, write: true });
  if (auth.response) return auth.response;
  if (auth.user.role !== "admin") return adJson({ error: "ADMIN_REQUIRED" }, 403);
  const rate = await checkDrawRate({ db: env.DB, request, action: "verify", limit: 5 });
  if (rate.response) return rate.response;
  const parsed = await readAdsJson(request, 2048);
  if (parsed.error) return adJson({ error: parsed.error }, 400);
  const campaignId = typeof parsed.body.campaignId === "string" ? parsed.body.campaignId : "";
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return adJson({ error: "INVALID_CAMPAIGN_ID" }, 400);
  try {
    const result = await env.DB.prepare(
      "SELECT id, winning_entry_id, entropy_commitment, entropy_reveal, algorithm_version, eligible_entry_count, eligible_entries_sha256 FROM draw_results WHERE campaign_id = ?"
    ).bind(campaignId).first();
    if (!result) return adJson({ error: "DRAW_RESULT_NOT_FOUND" }, 404);
    if (result.algorithm_version !== "houshyar-draw-sha256-counter-rejection-v1") return adJson({ error: "UNSUPPORTED_DRAW_ALGORITHM" }, 409);
    const seed = fromHex(result.entropy_reveal);
    const commitment = hex(await sha256(seed));
    const entriesResult = await env.DB.prepare(
      "SELECT id, ticket_code, entry_status FROM draw_entries WHERE campaign_id = ? AND entry_status = 'eligible' ORDER BY id ASC"
    ).bind(campaignId).all();
    const entries = entriesResult.results || [];
    const snapshotHash = hex(await sha256(new TextEncoder().encode(entries.map(entry => entry.id).join("\n"))));
    const words = await buildWords(seed);
    let index = 0;
    const recomputed = selectDrawWinner(entries, () => words[index++]);
    const checks = {
      commitmentMatches: commitment === result.entropy_commitment,
      winnerMatches: recomputed.id === result.winning_entry_id,
      eligibleEntryCount: entries.length,
      eligibleEntriesSha256: snapshotHash
    };
    checks.entryCountMatches = entries.length === Number(result.eligible_entry_count);
    checks.snapshotMatches = snapshotHash === result.eligible_entries_sha256;
    const verified = checks.commitmentMatches && checks.winnerMatches && checks.entryCountMatches && checks.snapshotMatches;
    await env.DB.prepare(
      "INSERT INTO draw_result_verifications (id, campaign_id, result_id, verification_status, checked_by, verification_details_json, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), campaignId, result.id, verified ? "verified" : "failed", auth.user.id, JSON.stringify(checks), new Date().toISOString()).run();
    return adJson({ verified, checks, verificationStatus: verified ? "verified" : "failed" }, verified ? 200 : 409);
  } catch { return adJson({ error: "DRAW_VERIFICATION_FAILED" }, 503); }
}
