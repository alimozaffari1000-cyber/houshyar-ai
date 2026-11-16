import { checkChatRateLimit } from "./_lib/chat-rate-limit.js";
import { getSessionUser } from "./_lib/auth.js";
import { reserveDailyChat, releaseDailyChat } from "./_lib/daily-quota.js";
import { routeAgentRequest, resolveResponseMode, buildCollaborationPlan, listAgents } from "./_lib/agent-router.js";
import { resolveProvider, requestModel, streamModel, listAvailableProviders } from "./_lib/model-providers.js";

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 20_000;

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function validateImageAttachments(value) {
  if (value == null) return { attachments: [], error: null };
  if (!Array.isArray(value) || value.length > 2) return { attachments: [], error: "INVALID_ATTACHMENTS" };
  const attachments = [];
  let totalBytes = 0;
  for (const item of value) {
    if (!item || typeof item !== "object" || !ALLOWED_IMAGE_TYPES.has(item.mimeType) ||
        typeof item.data !== "string") {
      return { attachments: [], error: "INVALID_ATTACHMENTS" };
    }
    if (item.data.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 8) {
      return { attachments: [], error: "ATTACHMENT_TOO_LARGE" };
    }
    const encoded = item.data.replace(/^data:[^,]+,/, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
      return { attachments: [], error: "INVALID_ATTACHMENTS" };
    }
    let bytes;
    try {
      const binary = atob(encoded);
      bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    } catch {
      return { attachments: [], error: "INVALID_ATTACHMENTS" };
    }
    if (!bytes.length || bytes.byteLength > MAX_IMAGE_BYTES) return { attachments: [], error: "ATTACHMENT_TOO_LARGE" };
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) return { attachments: [], error: "ATTACHMENT_TOO_LARGE" };
    const signature = [...bytes.slice(0, 12)];
    const isJpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    const isPng = signature.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
    const isGif = ["GIF87a", "GIF89a"].some(magic => String.fromCharCode(...signature.slice(0, 6)) === magic);
    const isWebp = String.fromCharCode(...signature.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
    const signatureMatches =
      (item.mimeType === "image/jpeg" && isJpeg) ||
      (item.mimeType === "image/png" && isPng) ||
      (item.mimeType === "image/gif" && isGif) ||
      (item.mimeType === "image/webp" && isWebp);
    if (!signatureMatches) return { attachments: [], error: "INVALID_ATTACHMENTS" };
    attachments.push({ mimeType: item.mimeType, data: encoded });
  }
  return { attachments, error: null };
}

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
    return { body: JSON.parse(new TextDecoder().decode(bytes)), bytes: total };
  } catch {
    return { error: "INVALID_JSON" };
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.GROQ_API_KEY && !env.OPENAI_API_KEY && !env.CLAUDE_API_KEY && !env.GEMINI_API_KEY) return json({ error: "AI_NOT_CONFIGURED", message: "هیچ ارائه‌دهنده هوش مصنوعی پیکربندی نشده است." }, 503);
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
  if ((!Array.isArray(body?.attachments) || body.attachments.length === 0) && parsed.bytes > 32 * 1024) {
    return json({ error: "BODY_TOO_LARGE", message: "حجم درخواست بیش از حد مجاز است." }, 413);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "INVALID_BODY", message: "ساختار درخواست معتبر نیست." }, 400);
  }

  const incoming = Array.isArray(body.history) ? body.history : [];
  const latest = typeof body.message === "string" ? body.message.trim() : "";
  if (!latest) return json({ error: "MESSAGE_REQUIRED", message: "متن پیام خالی است." }, 400);
  if (latest.length > 6000) return json({ error: "MESSAGE_TOO_LONG", message: "پیام بیش از حد طولانی است." }, 413);
  const validatedImages = validateImageAttachments(body.attachments);
  if (validatedImages.error) {
    const tooLarge = validatedImages.error === "ATTACHMENT_TOO_LARGE";
    return json({ error: validatedImages.error, message: tooLarge ? "حجم تصویر از حد مجاز بیشتر است." : "فایل تصویری معتبر یا مجاز نیست." }, tooLarge ? 413 : 400);
  }
  if (validatedImages.attachments.length && body.compare === true) {
    return json({ error: "COMPARE_UNSUPPORTED_WITH_ATTACHMENTS", message: "مقایسه هم‌زمان مدل‌ها برای پیام دارای تصویر در این نسخه فعال نیست." }, 400);
  }

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

  const requestedMode = body.mode == null ? "auto" : (["auto", "fast", "balanced", "deep", "creative"].includes(body.mode) ? body.mode : "balanced");
  const selectedAgent = routeAgentRequest(latest);
  const effectiveMode = resolveResponseMode(latest, requestedMode, selectedAgent);
  const requestedProvider = ["auto", "groq", "openai", "anthropic", "gemini"].includes(body.provider) ? body.provider : "auto";
  let providerChoice = resolveProvider(env, requestedProvider, effectiveMode);
  if (validatedImages.attachments.length && requestedProvider === "auto") {
    const imageProvider = env.GEMINI_API_KEY ? "gemini" : (env.CLAUDE_API_KEY ? "anthropic" : (env.OPENAI_API_KEY ? "openai" : (env.GROQ_API_KEY ? "groq" : "auto")));
    providerChoice = resolveProvider(env, imageProvider, effectiveMode);
  }
  if (providerChoice.error) {
    await releaseQuota();
    return json({ error: "PROVIDER_NOT_CONFIGURED", provider: providerChoice.provider, message: "ارائه‌دهنده انتخاب‌شده هنوز در تنظیمات سرور فعال نیست." }, 503);
  }
  const modelProfiles = {
    groq: { fast: env.GROQ_MODEL_FAST, balanced: env.GROQ_MODEL, deep: env.GROQ_MODEL_DEEP, creative: env.GROQ_MODEL_CREATIVE },
    openai: { fast: env.OPENAI_MODEL_FAST, balanced: env.OPENAI_MODEL, deep: env.OPENAI_MODEL_DEEP, creative: env.OPENAI_MODEL_CREATIVE },
    anthropic: { fast: env.CLAUDE_MODEL_FAST, balanced: env.CLAUDE_MODEL, deep: env.CLAUDE_MODEL_DEEP, creative: env.CLAUDE_MODEL_CREATIVE },
    gemini: { fast: env.GEMINI_MODEL_FAST, balanced: env.GEMINI_MODEL, deep: env.GEMINI_MODEL_DEEP, creative: env.GEMINI_MODEL_CREATIVE }
  };
  let model = validatedImages.attachments.length && providerChoice.provider === "groq"
    ? env.GROQ_MODEL_VISION
    : (modelProfiles[providerChoice.provider]?.[effectiveMode] || providerChoice.model);
  if (validatedImages.attachments.length && providerChoice.provider === "groq" && !env.GROQ_MODEL_VISION) {
    await releaseQuota();
    return json({ error: "VISION_NOT_CONFIGURED", message: "مدل بینایی Groq هنوز در تنظیمات سرور فعال نشده است." }, 503);
  }
  const messages = [
    { role: "system", content: "تو هسته هماهنگ‌کننده هوش‌یار هستی؛ یک دستیار چندمنظوره و چندزبانه که درخواست را تحلیل می‌کند، از تخصص عامل انتخاب‌شده استفاده می‌کند و پاسخ را برای کیفیت، دقت و ایمنی بازبینی می‌کند. خود را به‌جای ChatGPT یا ارائه‌دهنده زیرساخت جا نزن؛ اگر درباره موتور اجرا پرسیده شد، فقط نام ارائه‌دهنده واقعی را از فراداده درخواست بیان کن. پاسخ را به زبان کاربر، روشن و مرحله‌ای ارائه کن. اطلاعات نامطمئن را قطعی جلوه نده. برای موضوعات پزشکی، مالی و حقوقی محدودیت‌ها و ریسک‌ها را روشن کن. هرگز ادعا نکن جستجوی زنده، اقدام بیرونی، اجرای کد یا دسترسی به ابزار انجام داده‌ای مگر واقعاً انجام شده باشد.\n\nنقش تخصصی این درخواست: " + selectedAgent.instruction },
    ...safeHistory,
  ];
  if (messages[messages.length - 1]?.role !== "user" || messages[messages.length - 1]?.content !== latest) {
    messages.push({ role: "user", content: latest });
  }
  const buildMessagesForProvider = targetProvider => {
    const targetMessages = messages.map(item => ({ ...item }));
    if (validatedImages.attachments.length) {
      const lastUser = [...targetMessages].reverse().find(item => item.role === "user" && (item.content === latest || Array.isArray(item.content)));
      if (lastUser) {
        lastUser.content = [
          { type: "text", text: latest },
          ...validatedImages.attachments.map(image => targetProvider === "anthropic"
            ? { type: "image", source: { type: "base64", media_type: image.mimeType, data: image.data } }
            : { type: "image_url", image_url: { url: "data:" + image.mimeType + ";base64," + image.data } })
        ];
      }
    }
    return targetMessages;
  };
  messages.splice(0, messages.length, ...buildMessagesForProvider(providerChoice.provider));
  const availableProviderConfigs = listAvailableProviders(env);
  const modelForTarget = targetProvider => {
    if (validatedImages.attachments.length && targetProvider === "groq") return env.GROQ_MODEL_VISION;
    if (validatedImages.attachments.length && targetProvider === "openai" && env.OPENAI_MODEL_VISION) return env.OPENAI_MODEL_VISION;
    return modelProfiles[targetProvider]?.[effectiveMode] || availableProviderConfigs.find(item => item.id === targetProvider)?.defaultModel;
  };
  const fallbackProviders = () => availableProviderConfigs
    .filter(item => item.available && item.id !== providerChoice.provider)
    .filter(item => !validatedImages.attachments.length || item.id !== "groq" || Boolean(env.GROQ_MODEL_VISION))
    .map(item => item.id);

  if (body.compare === true) {
    let compareTargets;
    const configuredCompareProviders = listAvailableProviders(env).filter(item => item.available);
    if (configuredCompareProviders.length >= 2) {
      compareTargets = configuredCompareProviders.slice(0, 2).map(item => ({ provider: item.id, model: modelProfiles[item.id]?.[effectiveMode] || item.defaultModel }));
    } else if (env.GROQ_API_KEY && env.GROQ_MODEL_COMPARE_A && env.GROQ_MODEL_COMPARE_B && env.GROQ_MODEL_COMPARE_A !== env.GROQ_MODEL_COMPARE_B) {
      compareTargets = [
        { provider: "groq", model: env.GROQ_MODEL_COMPARE_A },
        { provider: "groq", model: env.GROQ_MODEL_COMPARE_B }
      ];
    } else {
      await releaseQuota();
      return json({ error: "COMPARE_NOT_CONFIGURED", message: "برای مقایسه، حداقل دو ارائه‌دهنده یا دو مدل متفاوت Groq را فعال کنید." }, 503);
    }
    const runComparison = async target => {
      const compareController = new AbortController();
      const compareTimeout = setTimeout(() => compareController.abort("upstream_timeout"), UPSTREAM_TIMEOUT_MS);
      try {
        const result = await requestModel({
          provider: target.provider, env, messages, model: target.model,
          signal: compareController.signal, maxTokens: 1200, temperature: 0.5, googleSearch: body.googleSearch === true && target.provider === "gemini"
        });
        return { provider: target.provider, model: result.model, reply: result.reply, usage: result.usage };
      } finally { clearTimeout(compareTimeout); }
    };
    try {
      const comparison = await Promise.all(compareTargets.map(runComparison));
      const usage = comparison.every(item => item.usage) ? comparison.reduce((sum, item) => ({
        promptTokens: sum.promptTokens + item.usage.promptTokens,
        completionTokens: sum.completionTokens + item.usage.completionTokens,
        totalTokens: sum.totalTokens + item.usage.totalTokens
      }), { promptTokens: 0, completionTokens: 0, totalTokens: 0 }) : null;
      const reply = comparison.map((item, index) => "مدل " + (index + 1) + " (" + item.provider + " / " + item.model + ")\\n" + item.reply).join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n");
      return json({ reply, compare: true, comparison, usage, provider: "comparison", providers: comparison.map(item => item.provider), agent: { id: selectedAgent.id, label: selectedAgent.label, labelEn: selectedAgent.labelEn } });
    } catch {
      await releaseQuota();
      return json({ error: "COMPARISON_FAILED", message: "مقایسه مدل‌ها کامل نشد. کلیدها، اعتبار حساب و دسترسی مدل‌ها را بررسی کنید." }, 502);
    }
  }

  const collaborationPlan = body.collaborate === false ? [] : buildCollaborationPlan(latest, selectedAgent, effectiveMode);
  if (body.stream === true && body.compare !== true && collaborationPlan.length === 0) {
    const streamController = new AbortController();
    if (request.signal.aborted) streamController.abort("client_cancelled");
    else request.signal.addEventListener("abort", () => streamController.abort("client_cancelled"), { once: true });
    const streamTimeout = setTimeout(() => streamController.abort("upstream_timeout"), UPSTREAM_TIMEOUT_MS);
    const encoder = new TextEncoder();
    let streamCancelled = false;
    const send = (controller, event) => { if (!streamCancelled) controller.enqueue(encoder.encode("data: " + JSON.stringify(event) + "\n\n")); };
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let streamed = null;
          let activeProvider = providerChoice.provider;
          let emittedText = false;
          const candidates = [providerChoice.provider, ...(requestedProvider === "auto" ? fallbackProviders() : [])];
          for (const candidate of candidates) {
            try {
              streamed = await streamModel({
                provider: candidate, env, messages: buildMessagesForProvider(candidate), model: candidate === providerChoice.provider ? model : modelForTarget(candidate),
                signal: streamController.signal, maxTokens: 1200, temperature: 0.5, googleSearch: body.googleSearch === true && candidate === "gemini",
                onText: text => { emittedText = true; send(controller, { type: "delta", text }); }
              });
              activeProvider = candidate;
              break;
            } catch (error) {
              if (streamController.signal.aborted || request.signal.aborted || emittedText || requestedProvider !== "auto") throw error;
            }
          }
          if (!streamed) throw new Error("provider_request_failed");
          send(controller, { type: "done", model: streamed.model, usage: streamed.usage,
            mode: effectiveMode, requestedMode, provider: activeProvider,
            agent: { id: selectedAgent.id, label: selectedAgent.label, labelEn: selectedAgent.labelEn },
            collaboration: { enabled: false, status: "single_agent", agents: [{ id: selectedAgent.id, label: selectedAgent.label }] }, sources: streamed.sources || [] });
        } catch {
          await releaseQuota();
          send(controller, { type: "error", error: request.signal.aborted ? "REQUEST_CANCELLED" : (streamController.signal.aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR") });
        } finally {
          clearTimeout(streamTimeout);
          try { controller.close(); } catch { /* client already closed */ }
        }
      },
      cancel() { streamCancelled = true; streamController.abort("client_cancelled"); }
    });
    return new Response(stream, { status: 200, headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff"
    } });
  }

  const controller = new AbortController();
  if (request.signal.aborted) controller.abort("client_cancelled");
  else request.signal.addEventListener("abort", () => controller.abort("client_cancelled"), { once: true });
  const timeout = setTimeout(() => controller.abort("upstream_timeout"), UPSTREAM_TIMEOUT_MS);
  let result;
  let collaboration = { enabled: false, agents: [{ id: selectedAgent.id, label: selectedAgent.label }], status: "single_agent" };
  try {
    const plan = collaborationPlan;
    let primary;
    try {
      primary = await requestModel({
        provider: providerChoice.provider, env, messages: buildMessagesForProvider(providerChoice.provider), model,
        signal: controller.signal, maxTokens: plan.length ? 900 : 1200, temperature: 0.5, googleSearch: body.googleSearch === true && providerChoice.provider === "gemini", googleSearch: body.googleSearch === true && providerChoice.provider === "gemini"
      });
    } catch (primaryError) {
      if (requestedProvider !== "auto" || controller.signal.aborted) throw primaryError;
      let recovered = false;
      for (const candidate of fallbackProviders()) {
        try {
          const candidateModel = modelForTarget(candidate);
          primary = await requestModel({
            provider: candidate, env, messages: buildMessagesForProvider(candidate), model: candidateModel,
            signal: controller.signal, maxTokens: plan.length ? 900 : 1200, temperature: 0.5
          });
          providerChoice = { provider: candidate, model: candidateModel };
          model = candidateModel;
          recovered = true;
          break;
        } catch {
          if (controller.signal.aborted) throw primaryError;
        }
      }
      if (!recovered) throw primaryError;
    }
    result = primary;

    if (plan.length === 2 && !controller.signal.aborted) {
      const reviewer = listAgents().find(agent => agent.id === plan[1].id);
      const reviewMessages = [
        { role: "system", content: messages[0].content + "\n\nنقش بازبین همکار: " + plan[1].instruction +
          "\\nپیش‌نویس عامل اول را مستقل ارزیابی کن؛ خطاهای factual، تناقض‌ها، جاافتادگی‌ها و ریسک‌ها را اصلاح کن. زنجیره فکر خصوصی را افشا نکن. فقط پاسخ نهاییِ اصلاح‌شده و قابل ارائه به کاربر را بنویس." },
        ...messages.slice(1),
        { role: "assistant", content: primary.reply },
        { role: "user", content: "این پیش‌نویس را بازبینی کن و نسخه نهایی دقیق‌تر را ارائه بده. اگر بخشی نامطمئن است، محدودیت آن را صریح بیان کن." }
      ];
      try {
        const reviewed = await requestModel({
          provider: providerChoice.provider, env, messages: reviewMessages.map(item => item.role === "user" && Array.isArray(item.content) ? { ...item, content: buildMessagesForProvider(providerChoice.provider).find(message => message.role === "user" && Array.isArray(message.content))?.content || item.content } : item), model,
          signal: controller.signal, maxTokens: 1400, temperature: 0.3, googleSearch: body.googleSearch === true && providerChoice.provider === "gemini"
        });
        result = {
          ...reviewed,
          usage: primary.usage && reviewed.usage ? {
            promptTokens: primary.usage.promptTokens + reviewed.usage.promptTokens,
            completionTokens: primary.usage.completionTokens + reviewed.usage.completionTokens,
            totalTokens: primary.usage.totalTokens + reviewed.usage.totalTokens
          } : reviewed.usage || primary.usage
        };
        collaboration = {
          enabled: true,
          status: "completed",
          agents: plan.map(item => ({ id: item.id, label: item.label })),
          stages: ["draft", "review_and_synthesis"]
        };
      } catch (error) {
        if (request.signal.aborted) throw error;
        // Preserve the first useful answer if the review stage fails or times out.
        collaboration = {
          enabled: true,
          status: "partial",
          agents: plan.slice(0, 1).map(item => ({ id: item.id, label: item.label })),
          reason: "review_stage_unavailable"
        };
      }
    }
  } catch {
    await releaseQuota();
    if (request.signal.aborted) return json({ error: "REQUEST_CANCELLED", message: "درخواست توسط کاربر متوقف شد." }, 499);
    if (controller.signal.aborted) {
      return json({ error: "UPSTREAM_TIMEOUT", message: "پاسخ سرویس هوش مصنوعی بیش از زمان مجاز طول کشید." }, 504);
    }
    return json({ error: "UPSTREAM_ERROR", message: "ارائه‌دهنده هوش مصنوعی موقتاً پاسخ‌گو نیست یا تنظیمات آن معتبر نیست." }, 502);
  } finally {
    clearTimeout(timeout);
  }
  return json({
    reply: result.reply,
    mode: effectiveMode,
    requestedMode,
    provider: providerChoice.provider,
    model: result.model,
    usage: result.usage,\n    sources: result.sources || [],
    agent: { id: selectedAgent.id, label: selectedAgent.label, labelEn: selectedAgent.labelEn },
    collaboration
  });
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
