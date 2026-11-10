import { adJson } from "../_lib/draws.js";

export async function onRequestGet({ request, env }) {
  if (env.DRAW_MODULE_ENABLED !== "true" || !env.DB) {
    return adJson({ error: "DRAWS_NOT_CONFIGURED" }, 503);
  }
  const campaignId = new URL(request.url).searchParams.get("campaignId");
  if (!campaignId || !/^[0-9a-f-]{36}$/i.test(campaignId)) return adJson({ error: "INVALID_CAMPAIGN_ID" }, 400);
  try {
    const row = await env.DB.prepare(
      "SELECT r.campaign_id, r.algorithm_version, r.entropy_commitment, r.entropy_reveal, r.selected_at, " +
      "(SELECT v.verification_status FROM draw_result_verifications v WHERE v.result_id = r.id ORDER BY v.checked_at DESC LIMIT 1) AS verification_status, " +
      "CASE WHEN (SELECT v.verification_status FROM draw_result_verifications v WHERE v.result_id = r.id ORDER BY v.checked_at DESC LIMIT 1) = 'verified' THEN e.ticket_code ELSE NULL END AS winning_ticket_code " +
      "FROM draw_results r JOIN draw_entries e ON e.id = r.winning_entry_id AND e.campaign_id = r.campaign_id " +
      "WHERE r.campaign_id = ? LIMIT 1"
    ).bind(campaignId).first();
    if (!row) return adJson({ error: "DRAW_RESULT_NOT_FOUND" }, 404);
    const verified = row.verification_status === "verified";
    return adJson({
      result: {
        campaignId: row.campaign_id,
        status: verified ? "verified" : "pending_verification",
        winningTicketCode: verified ? row.winning_ticket_code : null,
        algorithmVersion: row.algorithm_version,
        entropyCommitment: row.entropy_commitment,
        entropyReveal: verified ? row.entropy_reveal : null,
        selectedAt: row.selected_at
      }
    });
  } catch { return adJson({ error: "DRAW_RESULT_UNAVAILABLE" }, 503); }
}
