import { requireDrawUser, checkDrawRate, adJson, readAdsJson } from "../../_lib/draws.js";
import { selectDrawWinner } from "../../../../src/draw/draw-engine.js";

const hex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}
async function buildRandomWords(seed, count = 128) {
  const words = [];
  for (let counter = 0; words.length < count; counter += 1) {
    const input = new Uint8Array(seed.length + 4);
    input.set(seed);
    new DataView(input.buffer).setUint32(seed.length, counter, false);
    const block = await sha256(input);
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
    for (let offset = 0; offset < block.length && words.length < count; offset += 4) {
      words.push(view.getUint32(offset, false));
    }
  }
  return words;
}

export async function onRequestPost({ request, env }) {
  const auth = await requireDrawUser({ request, env, write: true });
  if (auth.response) return auth.response;
  if (auth.user.role !== "admin") return adJson({ error: "ADMIN_REQUIRED" }, 403);
  const rate = await checkDrawRate({ db: env.DB, request, action: "execute", limit: 2 });
  if (rate.response) return rate.response;
  const parsed = await readAdsJson(request, 2048);
  if (parsed.error) return adJson({ error: parsed.error }, 400);
  const campaignId = typeof parsed.body.campaignId === "string" ? parsed.body.campaignId : "";
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return adJson({ error: "INVALID_CAMPAIGN_ID" }, 400);

  try {
    const campaign = await env.DB.prepare("SELECT id, status, ends_at, draw_at FROM draw_campaigns WHERE id = ?").bind(campaignId).first();
    if (!campaign) return adJson({ error: "DRAW_NOT_FOUND" }, 404);
    if (campaign.status !== "open") return adJson({ error: "DRAW_NOT_OPEN" }, 409);
    const now = new Date().toISOString();
    if (campaign.ends_at && campaign.ends_at > now) return adJson({ error: "DRAW_ENTRY_PERIOD_ACTIVE" }, 409);
    if (campaign.draw_at && campaign.draw_at > now) return adJson({ error: "DRAW_TIME_NOT_REACHED" }, 409);
    const rows = await env.DB.prepare(
      "SELECT id, ticket_code, entry_status FROM draw_entries WHERE campaign_id = ? AND entry_status = 'eligible' ORDER BY id ASC"
    ).bind(campaignId).all();
    const entries = rows.results || [];
    if (!entries.length) return adJson({ error: "NO_ELIGIBLE_ENTRIES" }, 409);

    const seed = crypto.getRandomValues(new Uint8Array(32));
    const commitment = hex(await sha256(seed));
    const words = await buildRandomWords(seed);
    let index = 0;
    const winner = selectDrawWinner(entries, () => words[index++]);
    const resultId = crypto.randomUUID();
    const nowPublished = new Date().toISOString();
    const snapshotHash = hex(await sha256(new TextEncoder().encode(entries.map(entry => entry.id).join("\n"))));
    const payload = {
      eligibleEntryCount: entries.length,
      eligibleEntriesSha256: snapshotHash,
      algorithmVersion: "houshyar-draw-sha256-counter-rejection-v1"
    };

    const statements = [
      env.DB.prepare("UPDATE draw_campaigns SET status = 'drawn', updated_at = ? WHERE id = ? AND status = 'open'").bind(nowPublished, campaignId),
      env.DB.prepare(
        "INSERT INTO draw_results (id, campaign_id, winning_entry_id, algorithm_version, entropy_commitment, entropy_reveal, selected_at, published_at, verification_status, eligible_entry_count, eligible_entries_sha256) " +
        "SELECT ?, ?, ?, 'houshyar-draw-sha256-counter-rejection-v1', ?, ?, ?, ?, 'pending', ?, ? " +
        "WHERE EXISTS (SELECT 1 FROM draw_campaigns WHERE id = ? AND status = 'drawn') " +
        "AND NOT EXISTS (SELECT 1 FROM draw_results WHERE campaign_id = ?)"
      ).bind(resultId, campaignId, winner.id, commitment, hex(seed), nowPublished, nowPublished, entries.length, snapshotHash, campaignId, campaignId),
      env.DB.prepare(
        "INSERT INTO draw_audit_events (id, campaign_id, actor_user_id, event_type, event_payload_json, created_at) " +
        "SELECT ?, ?, ?, 'draw_executed', ?, ? WHERE EXISTS (SELECT 1 FROM draw_results WHERE campaign_id = ? AND id = ?)"
      ).bind(crypto.randomUUID(), campaignId, auth.user.id, JSON.stringify({ ...payload, winningEntryId: winner.id, entropyCommitment: commitment }), nowPublished, campaignId, resultId)
    ];
    const results = await env.DB.batch(statements);
    if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1) {
      return adJson({ error: "DRAW_EXECUTION_CONFLICT" }, 409);
    }
    return adJson({
      drawn: true,
      result: {
        campaignId,
        winningEntryId: winner.id,
        winningTicketCode: winner.ticketCode || null,
        eligibleEntryCount: entries.length,
        eligibleEntriesSha256: snapshotHash,
        algorithmVersion: payload.algorithmVersion,
        entropyCommitment: commitment,
        entropyReveal: hex(seed),
        verificationStatus: "pending"
      },
      note: "نتیجه ثبت شده است؛ راستی‌آزمایی مستقل باید پیش از اعلام نهایی انجام شود."
    }, 201);
  } catch { return adJson({ error: "DRAW_EXECUTION_FAILED" }, 503); }
}
