const MAX_RATE_MICRO_USD_PER_MILLION = 100_000_000_000;
function safeRate(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_RATE_MICRO_USD_PER_MILLION) return null;
  return parsed;
}
export function estimateUsageCostMicroUsd({ promptTokens = 0, completionTokens = 0, inputRate, outputRate }) {
  const input = safeRate(inputRate), output = safeRate(outputRate);
  if (input == null || output == null) return null;
  if (!Number.isSafeInteger(promptTokens) || promptTokens < 0 || !Number.isSafeInteger(completionTokens) || completionTokens < 0) return null;
  const estimate = (promptTokens * input + completionTokens * output) / 1_000_000;
  return Number.isSafeInteger(Math.round(estimate)) ? Math.round(estimate) : null;
}
export function getProviderRates(env, provider) {
  const prefix = provider === "anthropic" ? "CLAUDE" : provider === "google" ? "GEMINI" : "GROQ";
  return {
    inputRate: safeRate(env[prefix + "_INPUT_MICRO_USD_PER_MILLION"]),
    outputRate: safeRate(env[prefix + "_OUTPUT_MICRO_USD_PER_MILLION"])
  };
}
export async function recordAiUsage({ db, userId, provider, model, usage, requestId, webSearch = false, now = Math.floor(Date.now() / 1000), rates = {} }) {
  if (!db || !userId || !requestId || !provider || !model) throw new Error("USAGE_LEDGER_NOT_CONFIGURED");
  const promptTokens = Number.isSafeInteger(usage?.promptTokens) && usage.promptTokens >= 0 ? usage.promptTokens : null;
  const completionTokens = Number.isSafeInteger(usage?.completionTokens) && usage.completionTokens >= 0 ? usage.completionTokens : null;
  const totalTokens = Number.isSafeInteger(usage?.totalTokens) && usage.totalTokens >= 0 ? usage.totalTokens :
    (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null);
  const estimatedCostMicroUsd = promptTokens == null || completionTokens == null ? null :
    estimateUsageCostMicroUsd({ promptTokens, completionTokens, ...rates });
  await db.prepare(
    "INSERT INTO ai_usage_events (id, user_id, request_id, provider_code, model_code, prompt_tokens, completion_tokens, total_tokens, estimated_cost_micro_usd, web_search_used, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), userId, requestId, provider, model.slice(0, 120), promptTokens, completionTokens, totalTokens, estimatedCostMicroUsd, webSearch ? 1 : 0, now).run();
  return { promptTokens, completionTokens, totalTokens, estimatedCostMicroUsd };
}
