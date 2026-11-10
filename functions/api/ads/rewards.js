import { requireAdsUser, adJson } from "../_lib/ads.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireAdsUser({ request, env });
  if (auth.response) return auth.response;
  try {
    const row = await env.DB.prepare("SELECT COALESCE(SUM(amount_units), 0) AS balance, COUNT(*) AS entries FROM ad_reward_ledger WHERE user_id = ?")
      .bind(auth.user.id).first();
    return adJson({
      balanceUnits: Number(row?.balance || 0),
      ledgerEntries: Number(row?.entries || 0),
      currency: "HOUSHYAR_SERVICE_CREDIT",
      withdrawable: false,
      transferable: false
    });
  } catch { return adJson({ error: "REWARD_BALANCE_UNAVAILABLE" }, 503); }
}
