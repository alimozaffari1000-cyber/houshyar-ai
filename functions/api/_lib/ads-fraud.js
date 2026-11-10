// Conservative server-side heuristics. Scores only route events to human review.
export function scoreAdEvent({ eventType, recentSameTypeCount = 0, hasValidImpression = true }) {
  if (!["impression", "click"].includes(eventType)) throw new TypeError("INVALID_AD_EVENT_TYPE");
  if (!Number.isSafeInteger(recentSameTypeCount) || recentSameTypeCount < 0) throw new TypeError("INVALID_EVENT_COUNT");
  let score = 20;
  const reasons = [];
  if (recentSameTypeCount >= 5) { score += 45; reasons.push("repeated_same_type_events_10m"); }
  if (eventType === "click" && !hasValidImpression) { score += 35; reasons.push("click_without_valid_impression"); }
  return { riskScore: Math.min(100, score), reasons };
}
