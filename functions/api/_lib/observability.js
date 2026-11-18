const SAFE_PROVIDERS = new Set(["groq", "anthropic", "google", "comparison", "auto"]);
const SAFE_EVENTS = new Set(["provider_success", "provider_failure", "comparison_success", "comparison_failure"]);

export function createRequestTelemetry({ request, route = "unknown", env = {}, ctx, now = () => performance.now(), logger = console }) {
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
    const duration = Number.isFinite(durationMs) ? Math.max(0, Math.min(120000, Math.round(durationMs))) : elapsedMs();
    // Never pass request bodies, prompts, headers, credentials, user IDs, or upstream response bodies here.
    logger.log(JSON.stringify({
      type: "houshyar_observability",
      request_id: requestId,
      route: route === "chat" ? "chat" : "unknown",
      event,
      provider: safeProvider,
      status: safeStatus,
      elapsed_ms: duration,
      error_code: safeError,
      timestamp: new Date().toISOString()
    }));

    // D1 persistence is opt-in and stores operational metadata only.
    if (env.OBSERVABILITY_ENABLED === "true" && env.DB && typeof ctx?.waitUntil === "function") {
      try {
        const createdAt = Math.floor(Date.now() / 1000);
        const write = env.DB.prepare(
          "INSERT INTO operational_metrics (request_id, event, provider, status, elapsed_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(requestId, event, safeProvider, safeStatus, duration, createdAt).run()
          .then(() => env.DB.prepare("DELETE FROM operational_metrics WHERE created_at < ?").bind(createdAt - 14 * 86400).run())
          .catch(() => {});
        ctx.waitUntil(write);
      } catch {
        // Telemetry storage must never interrupt a user request.
      }
    }
  }

  function responseHeaders() {
    return {
      "X-Request-ID": requestId,
      "Server-Timing": "app;dur=" + elapsedMs()
    };
  }

  return { requestId, elapsedMs, log, responseHeaders };
}
