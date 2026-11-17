const SAFE_PROVIDERS = new Set(["groq", "anthropic", "google", "comparison", "auto"]);
const SAFE_EVENTS = new Set(["provider_success", "provider_failure", "comparison_success", "comparison_failure"]);

export function createRequestTelemetry({ request, route = "unknown", now = () => performance.now(), logger = console }) {
  const requestId = globalThis.crypto?.randomUUID?.() || "req-" + Math.random().toString(36).slice(2, 14);
  const startedAt = now();

  function elapsedMs() {
    return Math.max(0, Math.round(now() - startedAt));
  }

  function log(event, { provider = "auto", status = 0, errorCode = "none", durationMs } = {}) {
    if (!SAFE_EVENTS.has(event)) return;
    const safeProvider = SAFE_PROVIDERS.has(provider) ? provider : "auto";
    const safeStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
    const safeError = typeof errorCode === "string" && /^[a-z0-9_]{1,48}$/i.test(errorCode) ? errorCode : "unknown";
    // Never pass request bodies, prompts, headers, credentials, user IDs, or upstream response bodies here.
    logger.log(JSON.stringify({
      type: "houshyar_observability",
      request_id: requestId,
      route: route === "chat" ? "chat" : "unknown",
      event,
      provider: safeProvider,
      status: safeStatus,
      elapsed_ms: Number.isFinite(durationMs) ? Math.max(0, Math.min(120000, Math.round(durationMs))) : elapsedMs(),
      error_code: safeError,
      timestamp: new Date().toISOString()
    }));
  }

  function responseHeaders() {
    return {
      "X-Request-ID": requestId,
      "Server-Timing": "app;dur=" + elapsedMs()
    };
  }

  return { requestId, elapsedMs, log, responseHeaders };
}
