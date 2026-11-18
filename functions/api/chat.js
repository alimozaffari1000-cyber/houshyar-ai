import { checkChatRateLimit } from "./_lib/chat-rate-limit.js";
import { getSessionUser } from "./_lib/auth.js";
import { reserveDailyChat, releaseDailyChat } from "./_lib/daily-quota.js";
import { routeAgentRequest, buildAgentPlan } from "./_lib/agent-router.js";
import { resolveProvider, requestModel, listAvailableProviders } from "./_lib/model-providers.js";
import { createRequestTelemetry } from "./_lib/observability.js";
import { rankProvidersFromObservations } from "./_lib/provider-evaluator.js";

const MAX_BODY_BYTES = 32 * 1024;
const UPSTREAM_TIMEOUT_MS = 20_000;

const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  }
});

async function readJsonLimited(request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { error: "BODY_TOO_LARGE" };
  }

  if (!request.body) return { error: "INVALID_JSON" };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return { error: "BODY_TOO_LARGE" };
      }
      chunks.push(value);
    }
  } catch {
    return { error: "INVALID_JSON" };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { error: "INVALID_JSON" };
  }
}

export async function onRequestPost({ request, env, ctx }) {
  const telemetry = createRequestTelemetry({ request, route: "chat", env, ctx });
  if (!env.GROQ_API_KEY && !env.CLAUDE_API_KEY && !env.GEMINI_API_KEY) return json({ error: "AI_NOT_CONFIGURED", message: "هیچ ارائه‌دهنده هوش مصنوعی پیکربندی نشده است." }, 503);
  const contentType = (request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return json({ error: "UNSUPPORTED_MEDIA_TYPE", message: "نوع محتوای درخواست باید JSON باشد." }, 415);
  }

  const parsed = await readJsonLimited(request);
  if (parsed.error === "BODY_TOO_LARGE") {
    return json({ error: "BODY_TOO_LARGE", message: "حجم درخواست بیش از حد مجاز است." }, 413);
  }
  if (parsed.error) return json({ error: "INVALID_JSON", message: "درخواست معتبر نیست." }, 400);
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "INVALID_BODY", message: "ساختار درخواست معتبر نیست." }, 400);
  }

  const incoming = Array.isArray(body.history) ? body.history : [];
  const latest = typeof body.message === "string" ? body.message.trim() : "";
  if (!latest) return json({ error: "MESSAGE_REQUIRED", message: "متن پیام خالی است." }, 400);
  if (latest.length > 6000) return json({ error: "MESSAGE_TOO_LONG", message: "پیام بیش از حد طولانی است." }, 413);

  // Enable only after the D1 migration and DB binding have been configured.
  if (env.CHAT_RATE_LIMIT_ENABLED === "true") {
    if (!env.DB) {
      return json({ error: "RATE_LIMIT_NOT_CONFIGURED", message: "کنترل امنیتی سرویس هنوز آماده نیست." }, 503);
    }
    try {
      const rate = await checkChatRateLimit({
        db: env.DB,
        clientIp: request.headers.get("cf-connecting-ip") || "unknown",
        limit: Number(env.CHAT_RATE_LIMIT_PER_MINUTE) || 20
      });
      if (!rate.allowed) {
        return json(
          { error: "RATE_LIMITED", message: "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید." },
          429,
          { "Retry-After": String(rate.retryAfter) }
        );
      }
    } catch {
      // Fail closed: do not spend provider credits if the enabled limiter fails.
      return json({ error: "RATE_LIMIT_UNAVAILABLE", message: "کنترل امنیتی موقتاً در دسترس نیست." }, 503);
    }
  }

  let quotaReservation = null;
  let quotaUserId = null;
  let quotaUsageDate = null;
  if (env.CHAT_QUOTA_ENABLED === "true") {
    if (env.AUTH_ENABLED !== "true" || !env.DB) {
      return json({ error: "QUOTA_NOT_CONFIGURED", message: "سهمیه کاربری هنوز راه‌اندازی نشده است." }, 503);
    }
    try {
      const user = await getSessionUser(env.DB, request);
      if (!user) return json({ error: "AUTH_REQUIRED", message: "برای استفاده از این سرویس وارد حساب کاربری شوید." }, 401);
      quotaUserId = user.id;
      quotaReservation = await reserveDailyChat({ db: env.DB, userId: quotaUserId, limit: env.FREE_DAILY_CHAT_LIMIT });
      quotaUsageDate = quotaReservation.usageDate;
      if (!quotaReservation.allowed) {
        return json(
          { error: "DAILY_QUOTA_EXCEEDED", message: "سهمیه روزانه گفتگو به پایان رسیده است.", limit: quotaReservation.limit, resetAt: quotaReservation.resetAt },
          429,
          { "Retry-After": String(Math.max(1, quotaReservation.resetAt - Math.floor(Date.now() / 1000))) }
        );
      }
    } catch {
      return json({ error: "QUOTA_UNAVAILABLE", message: "سامانه سهمیه‌بندی موقتاً در دسترس نیست." }, 503);
    }
  }
  const releaseQuota = async () => {
    if (!quotaReservation?.allowed || !quotaUserId) return;
    try { await releaseDailyChat({ db: env.DB, userId: quotaUserId, usageDate: quotaUsageDate }); } catch { /* generic provider error */ }
    quotaReservation = null;
  };

  const safeHistory = [];
  let historyChars = 0;
  for (const item of incoming.slice(-10)) {
    if (!item || !["user", "assistant"].includes(item.role)) continue;
    const raw = item.content ?? item.text;
    if (typeof raw !== "string" || !raw.trim() || historyChars >= 12000) continue;
    const content = raw.trim().slice(0, Math.min(3000, 12000 - historyChars));
    if (!content) continue;
    safeHistory.push({ role: item.role, content });
    historyChars += content.length;
  }

  const requestedMode = ["fast", "balanced", "deep", "creative"].includes(body.mode) ? body.mode : "balanced";
  const requestedProvider = ["auto", "groq", "anthropic", "google"].includes(body.provider) ? body.provider : "auto";
  let providerChoice = resolveProvider(env, requestedProvider, requestedMode);
  let selectionStrategy = "configured_default";
  // Automatic ranking is opt-in and uses only recent aggregate operational metrics.
  // Missing schema, insufficient samples, or disabled telemetry keeps the established safe default.
  if (requestedProvider === "auto" && env.OBSERVABILITY_ENABLED === "true" && env.DB && ["fast", "balanced"].includes(requestedMode)) {
    try {
      const since = Math.floor(Date.now() / 1000) - 24 * 3600;
      const metrics = await env.DB.prepare(
        "SELECT provider, SUM(CASE WHEN event = 'provider_success' THEN 1 ELSE 0 END) AS successes, SUM(CASE WHEN event = 'provider_failure' THEN 1 ELSE 0 END) AS failures, AVG(CASE WHEN event = 'provider_success' THEN elapsed_ms END) AS avg_latency_ms FROM operational_metrics WHERE created_at >= ? AND event IN ('provider_success', 'provider_failure') GROUP BY provider"
      ).bind(since).all();
      const observations = (Array.isArray(metrics?.results) ? metrics.results : []).map(row => ({
        provider: row.provider,
        successes: Number(row.successes) || 0,
        failures: Number(row.failures) || 0,
        avgLatencyMs: Number(row.avg_latency_ms) || 0
      }));
      const ranked = rankProvidersFromObservations(listAvailableProviders(env), observations, { mode: requestedMode === "fast" ? "speed" : "balanced" });
      if (ranked.selected) {
        const selected = listAvailableProviders(env).find(item => item.id === ranked.selected);
        providerChoice = { provider: selected.id, model: selected.defaultModel };
        selectionStrategy = "observed_performance";
      }
    } catch {
      // A missing migration or unavailable metrics store must not block chat.
    }
  }
  if (providerChoice.error) {
    await releaseQuota();
    return json({ error: "PROVIDER_NOT_CONFIGURED", provider: providerChoice.provider, message: "ارائه‌دهنده انتخاب‌شده هنوز در تنظیمات سرور فعال نیست." }, 503);
  }
  const groqModelByMode = { fast: env.GROQ_MODEL_FAST, balanced: env.GROQ_MODEL, deep: env.GROQ_MODEL_DEEP, creative: env.GROQ_MODEL_CREATIVE };
  const model = providerChoice.provider === "anthropic"
    ? (env.CLAUDE_MODEL || providerChoice.model)
    : providerChoice.provider === "google"
      ? (env.GEMINI_MODEL || providerChoice.model)
      : (groqModelByMode[requestedMode] || providerChoice.model);
  const selectedAgent = routeAgentRequest(latest);
  const agentWorkflow = buildAgentPlan(latest);
  const messages = [
    { role: "system", content: "تو هوش‌یار، یک دستیار چندمنظوره و چندزبانه دقیق و کاربردی هستی. پاسخ را به زبان کاربر، روشن و مرحله‌ای ارائه کن. اطلاعات نامطمئن را قطعی جلوه نده. برای موضوعات پزشکی، مالی و حقوقی محدودیت‌ها و ریسک‌ها را روشن کن. هرگز ادعا نکن جستجوی زنده، اقدام بیرونی، اجرای کد یا دسترسی به ابزار انجام داده‌ای مگر واقعاً انجام شده باشد.\n\nنقش تخصصی این درخواست: " + selectedAgent.instruction },
    ...safeHistory,
  ];
  if (messages[messages.length - 1]?.role !== "user" || messages[messages.length - 1]?.content !== latest) {
    messages.push({ role: "user", content: latest });
  }

  if (body.compare === true && !(body.webSearch === true && providerChoice.provider === "google")) {
    let compareTargets;
    if (env.GROQ_API_KEY && env.CLAUDE_API_KEY) {
      compareTargets = [
        { provider: "groq", model: groqModelByMode[requestedMode] || env.GROQ_MODEL || "llama-3.3-70b-versatile" },
        { provider: "anthropic", model: env.CLAUDE_MODEL || "claude-sonnet-5-5" }
      ];
    } else if (env.GROQ_API_KEY && env.GROQ_MODEL_COMPARE_A && env.GROQ_MODEL_COMPARE_B && env.GROQ_MODEL_COMPARE_A !== env.GROQ_MODEL_COMPARE_B) {
      compareTargets = [
        { provider: "groq", model: env.GROQ_MODEL_COMPARE_A },
        { provider: "groq", model: env.GROQ_MODEL_COMPARE_B }
      ];
    } else {
      await releaseQuota();
      return json({ error: "COMPARE_NOT_CONFIGURED", message: "برای مقایسه، کلید Claude را همراه Groq یا دو مدل متفاوت Groq تنظیم کنید." }, 503);
    }
    const runComparison = async target => {
      const compareController = new AbortController();
      const compareTimeout = setTimeout(() => compareController.abort("upstream_timeout"), UPSTREAM_TIMEOUT_MS);
      const providerStartedAt = performance.now();
      try {
        const result = await requestModel({
          provider: target.provider, env, messages, model: target.model,
          signal: compareController.signal, maxTokens: 1200, temperature: 0.5
        });
        telemetry.log("comparison_success", { provider: target.provider, status: 200, durationMs: performance.now() - providerStartedAt });
        return { provider: target.provider, model: result.model, reply: result.reply, usage: result.usage };
      } catch {
        telemetry.log("comparison_failure", {
          provider: target.provider,
          status: compareController.signal.aborted ? 504 : 502,
          errorCode: compareController.signal.aborted ? "upstream_timeout" : "provider_error",
          durationMs: performance.now() - providerStartedAt
        });
        throw new Error("comparison_provider_failed");
      } finally { clearTimeout(compareTimeout); }
    };
    try {
      const comparison = await Promise.all(compareTargets.map(runComparison));
      const usage = comparison.every(item => item.usage) ? comparison.reduce((sum, item) => ({
        promptTokens: sum.promptTokens + item.usage.promptTokens,
        completionTokens: sum.completionTokens + item.usage.completionTokens,
        totalTokens: sum.totalTokens + item.usage.totalTokens
      }), { promptTokens: 0, completionTokens: 0, totalTokens: 0 }) : null;
      const reply = comparison.map((item, index) => "مدل " + (index + 1) + " (" + item.provider + " / " + item.model + ")\\n" + item.reply).join("\\n\\n━━━━━━━━━━━━━━━━━━━━\\n\\n");
      return json({ reply, compare: true, comparison, usage, provider: "comparison", providers: comparison.map(item => item.provider), agent: { id: selectedAgent.id, label: selectedAgent.label, labelEn: selectedAgent.labelEn } }, 200, telemetry.responseHeaders());
    } catch {
      telemetry.log("comparison_failure", { provider: "comparison", status: 502, errorCode: "comparison_failed" });
      await releaseQuota();
      return json({ error: "COMPARISON_FAILED", message: "مقایسه مدل‌ها کامل نشد. کلیدها، اعتبار حساب و دسترسی مدل‌ها را بررسی کنید." }, 502, telemetry.responseHeaders());
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("upstream_timeout"), UPSTREAM_TIMEOUT_MS);
  const providerStartedAt = performance.now();
  let result;
  let responseProvider = providerChoice.provider;
  let fallbackUsed = false;
  try {
    result = await requestModel({
      provider: providerChoice.provider, env, messages, model,
      signal: controller.signal, maxTokens: 1200, temperature: 0.5,
      webSearch: body.webSearch === true && providerChoice.provider === "google"
    });
    telemetry.log("provider_success", { provider: providerChoice.provider, status: 200, durationMs: performance.now() - providerStartedAt });
  } catch {
    const timedOut = controller.signal.aborted;
    telemetry.log("provider_failure", { provider: providerChoice.provider, status: timedOut ? 504 : 502, errorCode: timedOut ? "upstream_timeout" : "upstream_error", durationMs: performance.now() - providerStartedAt });
    // Automatic mode may try one other configured provider. Explicit user choices never silently switch.
    const fallback = requestedProvider === "auto"
      ? listAvailableProviders(env).find(item => item.available && item.id !== providerChoice.provider)
      : null;
    if (fallback) {
      const fallbackController = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackController.abort("upstream_timeout"), UPSTREAM_TIMEOUT_MS);
      const fallbackStartedAt = performance.now();
      const fallbackModel = fallback.id === "anthropic"
        ? (env.CLAUDE_MODEL || fallback.defaultModel)
        : fallback.id === "google"
          ? (env.GEMINI_MODEL || fallback.defaultModel)
          : (groqModelByMode[requestedMode] || fallback.defaultModel);
      try {
        result = await requestModel({
          provider: fallback.id, env, messages, model: fallbackModel,
          signal: fallbackController.signal, maxTokens: 1200, temperature: 0.5,
          webSearch: body.webSearch === true && fallback.id === "google"
        });
        responseProvider = fallback.id;
        fallbackUsed = true;
        telemetry.log("provider_success", { provider: fallback.id, status: 200, durationMs: performance.now() - fallbackStartedAt });
      } catch {
        telemetry.log("provider_failure", {
          provider: fallback.id,
          status: fallbackController.signal.aborted ? 504 : 502,
          errorCode: fallbackController.signal.aborted ? "upstream_timeout" : "upstream_error",
          durationMs: performance.now() - fallbackStartedAt
        });
        await releaseQuota();
        if (timedOut && fallbackController.signal.aborted) {
          return json({ error: "UPSTREAM_TIMEOUT", message: "مدل اصلی و مدل جایگزین در زمان مجاز پاسخ ندادند." }, 504, telemetry.responseHeaders());
        }
        return json({ error: "UPSTREAM_ERROR", message: "مدل اصلی و مدل جایگزین موقتاً پاسخ‌گو نیستند." }, 502, telemetry.responseHeaders());
      } finally {
        clearTimeout(fallbackTimeout);
      }
    } else {
      await releaseQuota();
      if (timedOut) {
        return json({ error: "UPSTREAM_TIMEOUT", message: "پاسخ سرویس هوش مصنوعی بیش از زمان مجاز طول کشید." }, 504, telemetry.responseHeaders());
      }
      return json({ error: "UPSTREAM_ERROR", message: "ارائه‌دهنده هوش مصنوعی موقتاً پاسخ‌گو نیست یا تنظیمات آن معتبر نیست." }, 502, telemetry.responseHeaders());
    }
  } finally {
    clearTimeout(timeout);
  }
  return json({
    reply: result.reply,
    mode: requestedMode,
    provider: responseProvider,
    requestedProvider,
    fallbackUsed,
    selectionStrategy: fallbackUsed ? "automatic_fallback" : selectionStrategy,
    model: result.model,
    usage: result.usage,
    sources: Array.isArray(result.sources) ? result.sources : [],
    agent: { id: selectedAgent.id, label: selectedAgent.label, labelEn: selectedAgent.labelEn },
    agentWorkflow
  }, 200, telemetry.responseHeaders());
}

export async function onRequestGet({ env } = {}) {
  const providers = listAvailableProviders(env || {});
  const configured = providers.some(item => item.available);
  return json({
    service: "Houshyar AI API",
    status: configured ? "ready" : "configuration_required",
    aiConfigured: configured,
    providers: providers.map(({ id, available, defaultModel }) => ({ id, available, defaultModel })),
    method: "POST"
  }, configured ? 200 : 503);
}
