import { checkChatRateLimit } from "./_lib/chat-rate-limit.js";
import { getSessionUser } from "./_lib/auth.js";
import { reserveDailyChat, releaseDailyChat } from "./_lib/daily-quota.js";
import { routeAgentRequest } from "./_lib/agent-router.js";
import { coordinateAgentRequest } from "./_lib/agent-coordinator.js";

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

export async function onRequestPost({ request, env }) {
  if (!env.GROQ_API_KEY) return json({ error: "AI_NOT_CONFIGURED", message: "سرویس هوش مصنوعی هنوز تنظیم نشده است." }, 503);
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
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
  if (env.CHAT_QUOTA_ENABLED === "true") {
    if (env.AUTH_ENABLED !== "true" || !env.DB) {
      return json({ error: "QUOTA_NOT_CONFIGURED", message: "سهمیه کاربری هنوز راه‌اندازی نشده است." }, 503);
    }
    try {
      const user = await getSessionUser(env.DB, request);
      if (!user) return json({ error: "AUTH_REQUIRED", message: "برای استفاده از این سرویس وارد حساب کاربری شوید." }, 401);
      quotaUserId = user.id;
      quotaReservation = await reserveDailyChat({ db: env.DB, userId: quotaUserId, limit: env.FREE_DAILY_CHAT_LIMIT });
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
    try { await releaseDailyChat({ db: env.DB, userId: quotaUserId }); } catch { /* generic provider error */ }
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

  const selectedAgent = routeAgentRequest(latest);
  // Multi-specialist orchestration is explicitly opt-in and disabled by default.
  if (body.mode === "coordinated") {
    if (env.AGENT_COORDINATION_ENABLED !== "true") {
      await releaseQuota();
      return json({ error: "COORDINATION_DISABLED", message: "هماهنگی چندایجنتی هنوز در این محیط فعال نشده است." }, 503);
    }

    const executeSpecialist = async ({ instruction, prompt, maxTokens }) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort("agent_step_timeout"), 12_000);
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "تو یکی از متخصصان هوش‌یار هستی. فقط در محدوده تخصص خود پاسخ بده. هیچ ابزار یا اقدام بیرونی در اختیار نداری. نقش: " + instruction },
              { role: "user", content: prompt }
            ],
            temperature: 0.3,
            max_tokens: maxTokens
          }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error("UPSTREAM_ERROR");
        const payload = await response.json();
        const output = payload?.choices?.[0]?.message?.content;
        if (typeof output !== "string" || !output.trim()) throw new Error("EMPTY_REPLY");
        return output.trim();
      } finally {
        clearTimeout(timeout);
      }
    };

    try {
      const coordinated = await coordinateAgentRequest({ message: latest, execute: executeSpecialist });
      if (!coordinated.reply) {
        await releaseQuota();
        return json({
          error: coordinated.reason || "COORDINATION_FAILED",
          message: "هماهنگی متخصصان کامل نشد؛ دوباره تلاش کنید.",
          failures: coordinated.failures || []
        }, 502);
      }
      return json({
        reply: coordinated.reply,
        agent: { id: "coordinator", label: "هماهنگ‌کننده هوش‌یار", labelEn: "Houshyar coordinator" },
        coordination: {
          status: coordinated.reason,
          specialistSteps: coordinated.steps,
          failedSteps: coordinated.failures || [],
          maxSpecialists: 2,
          externalTools: false
        }
      });
    } catch {
      await releaseQuota();
      return json({ error: "COORDINATION_FAILED", message: "اجرای هماهنگی متخصصان ناموفق بود." }, 502);
    }
  }

  const messages = [
    { role: "system", content: "تو هوش‌یار، یک دستیار چندمنظوره و چندزبانه دقیق و کاربردی هستی. پاسخ را به زبان کاربر، روشن و مرحله‌ای ارائه کن. اطلاعات نامطمئن را قطعی جلوه نده. برای موضوعات پزشکی، مالی و حقوقی محدودیت‌ها و ریسک‌ها را روشن کن. هرگز ادعا نکن جستجوی زنده، اقدام بیرونی، اجرای کد یا دسترسی به ابزار انجام داده‌ای مگر واقعاً انجام شده باشد.\n\nنقش تخصصی این درخواست: " + selectedAgent.instruction },
    ...safeHistory,
  ];
  if (messages[messages.length - 1]?.role !== "user" || messages[messages.length - 1]?.content !== latest) {
    messages.push({ role: "user", content: latest });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("upstream_timeout"), UPSTREAM_TIMEOUT_MS);
  let upstream;
  let data;
  try {
    upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages,
        temperature: 0.5,
        max_tokens: 1200
      }),
      signal: controller.signal
    });
    if (upstream.ok) data = await upstream.json();
  } catch {
    if (controller.signal.aborted) {
      await releaseQuota();
      return json({ error: "UPSTREAM_TIMEOUT", message: "پاسخ سرویس هوش مصنوعی بیش از زمان مجاز طول کشید." }, 504);
    }
    if (upstream) {
      await releaseQuota();
      return json({ error: "EMPTY_REPLY", message: "پاسخ معتبری از مدل دریافت نشد." }, 502);
    }
    await releaseQuota();
    return json({ error: "UPSTREAM_UNAVAILABLE", message: "ارتباط با سرویس هوش مصنوعی برقرار نشد." }, 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok) {
    await releaseQuota();
    return json({ error: "UPSTREAM_ERROR", message: "سرویس هوش مصنوعی موقتاً پاسخ‌گو نیست." }, 502);
  }
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    await releaseQuota();
    return json({ error: "EMPTY_REPLY", message: "پاسخ معتبری از مدل دریافت نشد." }, 502);
  }
  return json({ reply: reply.trim(), agent: { id: selectedAgent.id, label: selectedAgent.label, labelEn: selectedAgent.labelEn } });
}

export async function onRequestGet() {
  return json({ service: "Houshyar AI API", status: "ready", method: "POST" }, 200);
}
