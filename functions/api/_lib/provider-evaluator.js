const PROVIDERS = new Set(["groq", "anthropic", "google"]);
const MODES = Object.freeze({
  speed: { latency: 0.55, quality: 0.15, reliability: 0.25, cost: 0.05 },
  quality: { latency: 0.03, quality: 0.85, reliability: 0.10, cost: 0.02 },
  economy: { latency: 0.10, quality: 0.20, reliability: 0.25, cost: 0.45 },
  balanced: { latency: 0.25, quality: 0.30, reliability: 0.30, cost: 0.15 }
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value) => typeof value === "number" && Number.isFinite(value);

function normalize(candidate) {
  if (!candidate || !PROVIDERS.has(candidate.provider) || candidate.available !== true) return null;
  const latency = finite(candidate.latencyMs) && candidate.latencyMs > 0 ? clamp(candidate.latencyMs, 1, 120000) : null;
  const quality = finite(candidate.qualityScore) ? clamp(candidate.qualityScore, 0, 100) / 100 : null;
  const reliability = finite(candidate.successRate) ? clamp(candidate.successRate, 0, 1) : null;
  const cost = finite(candidate.costPer1kTokens) && candidate.costPer1kTokens >= 0 ? candidate.costPer1kTokens : null;
  return { provider: candidate.provider, latency, quality, reliability, cost };
}

export function rankProviders(candidates, { mode = "balanced", requestedProvider = "auto" } = {}) {
  const validMode = Object.hasOwn(MODES, mode) ? mode : "balanced";
  const entries = Array.isArray(candidates) ? candidates.map(normalize).filter(Boolean) : [];
  const requested = requestedProvider === "auto" ? "auto" : requestedProvider;

  if (requested !== "auto") {
    if (!PROVIDERS.has(requested)) return { selected: null, reason: "unsupported_explicit_provider", ranked: [] };
    const chosen = entries.find(item => item.provider === requested);
    return {
      selected: chosen?.provider || null,
      reason: chosen ? "explicit_user_selection" : "explicit_provider_unavailable",
      ranked: chosen ? [{ provider: chosen.provider, score: null }] : []
    };
  }

  if (!entries.length) return { selected: null, reason: "no_available_candidates", ranked: [] };

  const weights = MODES[validMode];
  const maxLatency = Math.max(1, ...entries.map(item => item.latency || 0));
  const maxCost = Math.max(0.000001, ...entries.map(item => item.cost ?? 0));
  const ranked = entries.map(item => {
    const dimensions = [
      ["latency", item.latency === null ? null : 1 - item.latency / maxLatency, weights.latency],
      ["quality", item.quality, weights.quality],
      ["reliability", item.reliability, weights.reliability],
      ["cost", item.cost === null ? null : 1 - item.cost / maxCost, weights.cost]
    ].filter(([, value]) => value !== null);
    const weightTotal = dimensions.reduce((sum, [, , weight]) => sum + weight, 0);
    const score = weightTotal ? dimensions.reduce((sum, [, value, weight]) => sum + value * weight, 0) / weightTotal : 0;
    return { provider: item.provider, score: Math.round(score * 10000) / 10000, evidenceDimensions: dimensions.map(([name]) => name) };
  }).sort((a, b) => b.score - a.score || a.provider.localeCompare(b.provider));

  return { selected: ranked[0].provider, reason: "best_observed_weighted_score", ranked };
}

export function rankProvidersFromObservations(configuredProviders, observations, { mode = "balanced", minSamples = 5 } = {}) {
  const configured = Array.isArray(configuredProviders) ? configuredProviders : [];
  const rows = Array.isArray(observations) ? observations : [];
  const candidates = configured.filter(item => item?.available === true && PROVIDERS.has(item.id)).flatMap(item => {
    const row = rows.find(value => value?.provider === item.id);
    if (!row) return [];
    const successes = finite(row.successes) ? Math.max(0, Math.floor(row.successes)) : 0;
    const failures = finite(row.failures) ? Math.max(0, Math.floor(row.failures)) : 0;
    const samples = successes + failures;
    const latencyMs = finite(row.avgLatencyMs) && row.avgLatencyMs > 0 ? row.avgLatencyMs : null;
    if (samples < minSamples || successes === 0 || latencyMs === null) return [];
    return [{ provider: item.id, available: true, latencyMs, successRate: successes / samples }];
  });
  return rankProviders(candidates, { mode });
}
