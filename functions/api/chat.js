const MAX_BODY_BYTES = 32 * 1024;
const UPSTREAM_TIMEOUT_MS = 20_000;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
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

  const messages = [
    { role: "system", content: "تو هوش‌یار، یک دستیار فارسی دقیق، کاربردی و چندمنظوره هستی. پاسخ‌ها را به زبان کاربر، روشن و مرحله‌ای ارائه کن. اطلاعات نامطمئن را قطعی جلوه نده. برای موضوعات پزشکی، مالی و حقوقی محدودیت‌ها و ریسک‌ها را روشن کن." },
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
      return json({ error: "UPSTREAM_TIMEOUT", message: "پاسخ سرویس هوش مصنوعی بیش از زمان مجاز طول کشید." }, 504);
    }
    if (upstream) {
      return json({ error: "EMPTY_REPLY", message: "پاسخ معتبری از مدل دریافت نشد." }, 502);
    }
    return json({ error: "UPSTREAM_UNAVAILABLE", message: "ارتباط با سرویس هوش مصنوعی برقرار نشد." }, 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok) {
    return json({ error: "UPSTREAM_ERROR", message: "سرویس هوش مصنوعی موقتاً پاسخ‌گو نیست." }, 502);
  }
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    return json({ error: "EMPTY_REPLY", message: "پاسخ معتبری از مدل دریافت نشد." }, 502);
  }
  return json({ reply: reply.trim() });
}

export async function onRequestGet() {
  return json({ service: "Houshyar AI API", status: "ready", method: "POST" }, 200);
}
