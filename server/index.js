import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { routeAgentRequest } from "../functions/api/_lib/agent-router.js";
import { resolveProvider, requestModel, listAvailableProviders } from "../functions/api/_lib/model-providers.js";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 32 * 1024;
const TIMEOUT_MS = 20_000;
const WINDOW_MS = 60_000;
const RATE_LIMIT = Math.max(1, Number(process.env.IR_RATE_LIMIT_PER_MINUTE || 12));
const buckets = new Map();
const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8"
};

function send(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function allowed(ip) {
  const now = Date.now();
  const entry = buckets.get(ip);
  if (!entry || now - entry.start >= WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT;
}

async function readBody(req) {
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > MAX_BODY_BYTES) throw Object.assign(new Error("BODY_TOO_LARGE"), { status: 413 });
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("BODY_TOO_LARGE"), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("INVALID_JSON"), { status: 400 }); }
}

function chooseModel(provider, mode, env) {
  if (provider === "anthropic") return env.CLAUDE_MODEL || "claude-sonnet-5-5";
  if (provider === "google") return env.GEMINI_MODEL || "gemini-2.5-flash";
  if (provider === "deepseek") return mode === "deep"
    ? (env.DEEPSEEK_MODEL_DEEP || env.DEEPSEEK_MODEL_PRO || "deepseek-v4-pro")
    : (env.DEEPSEEK_MODEL || "deepseek-flash");
  const key = { fast: "GROQ_MODEL_FAST", balanced: "GROQ_MODEL", deep: "GROQ_MODEL_DEEP", creative: "GROQ_MODEL_CREATIVE" }[mode];
  return (key && env[key]) || env.GROQ_MODEL || "llama-3.3-70b-versatile";
}

async function chat(req, res) {
  const ip = req.socket.remoteAddress || "unknown";
  if (!allowed(ip)) return send(res, 429, { error: "RATE_LIMITED", message: "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید." }, { "Retry-After": "60" });
  if ((req.headers["content-type"] || "").split(";")[0].trim().toLowerCase() !== "application/json") {
    return send(res, 415, { error: "UNSUPPORTED_MEDIA_TYPE", message: "درخواست باید JSON باشد." });
  }
  let body;
  try { body = await readBody(req); }
  catch (error) { return send(res, error.status || 400, { error: error.message || "INVALID_JSON" }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return send(res, 400, { error: "INVALID_BODY" });
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return send(res, 400, { error: "MESSAGE_REQUIRED", message: "متن پیام خالی است." });
  if (message.length > 6000) return send(res, 413, { error: "MESSAGE_TOO_LONG" });

  const env = process.env;
  const mode = ["fast", "balanced", "deep", "creative"].includes(body.mode) ? body.mode : "balanced";
  const requested = ["auto", "groq", "anthropic", "google", "deepseek"].includes(body.provider) ? body.provider : "auto";
  const selected = resolveProvider(env, requested, mode);
  if (selected.error) return send(res, 503, { error: "AI_NOT_CONFIGURED", message: "هیچ موتور هوش مصنوعی سازگار در سرور داخلی تنظیم نشده است." });

  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  let chars = 0;
  const safeHistory = [];
  for (const item of history) {
    if (!item || !["user", "assistant"].includes(item.role)) continue;
    const raw = item.content ?? item.text;
    if (typeof raw !== "string" || !raw.trim() || chars >= 12000) continue;
    const content = raw.trim().slice(0, Math.min(3000, 12000 - chars));
    safeHistory.push({ role: item.role, content });
    chars += content.length;
  }
  const agent = routeAgentRequest(message);
  const messages = [
    { role: "system", content: "تو هوش‌یار، دستیار دقیق و چندزبانه هستی. به زبان کاربر پاسخ بده. اطلاعات نامطمئن را قطعی جلوه نده و محدودیت‌ها را روشن کن.\n\nنقش تخصصی: " + agent.instruction },
    ...safeHistory
  ];
  if (messages.at(-1)?.role !== "user" || messages.at(-1)?.content !== message) messages.push({ role: "user", content: message });

  if (body.compare === true) return send(res, 501, { error: "COMPARE_NOT_AVAILABLE_ON_IR_NODE", message: "حالت مقایسه مدل‌ها در نسخه داخلی هنوز فعال نشده است." });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const result = await requestModel({
      provider: selected.provider, env, messages,
      model: chooseModel(selected.provider, mode, env),
      signal: controller.signal, maxTokens: 1200, temperature: 0.5,
      webSearch: body.webSearch === true && selected.provider === "google",
      thinking: mode === "deep"
    });
    return send(res, 200, {
      reply: result.reply, mode, provider: selected.provider, model: result.model,
      usage: result.usage, sources: Array.isArray(result.sources) ? result.sources : [],
      agent: { id: agent.id, label: agent.label, labelEn: agent.labelEn }
    });
  } catch (error) {
    return send(res, controller.signal.aborted ? 504 : 502, {
      error: controller.signal.aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
      message: "موتور هوش مصنوعی پاسخ‌گو نیست یا دسترسی سرور به آن برقرار نیست."
    });
  } finally { clearTimeout(timer); }
}

function serveStatic(req, res) {
  const rawPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const requestedPath = rawPath === "/" ? "/index.html" : rawPath;
  const safePath = normalize(requestedPath).replace(/^([/\\])+/, "");
  let file = resolve(DIST, safePath);
  if (!file.startsWith(DIST + "/") && file !== join(DIST, "index.html")) {
    res.writeHead(403); return res.end("Forbidden");
  }
  if (!existsSync(file) || !statSync(file).isFile()) file = join(DIST, "index.html");
  if (!existsSync(file)) { res.writeHead(503); return res.end("Frontend build missing. Run npm run build."); }
  res.writeHead(200, {
    "Content-Type": mime[extname(file).toLowerCase()] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Cache-Control": file.endsWith("index.html") ? "no-cache" : "public, max-age=86400"
  });
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url?.split("?")[0] === "/api/chat") {
    const providers = listAvailableProviders(process.env);
    const ready = providers.some(item => item.available);
    return send(res, ready ? 200 : 503, {
      service: "Houshyar AI Iran API", status: ready ? "ready" : "configuration_required",
      aiConfigured: ready, providers: providers.map(({ id, available, defaultModel }) => ({ id, available, defaultModel })),
      method: "POST"
    });
  }
  if (req.method === "POST" && req.url?.split("?")[0] === "/api/chat") return chat(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "METHOD_NOT_ALLOWED" }, { Allow: "GET, HEAD, POST" });
  if ((req.url || "").startsWith("/api/")) return send(res, 404, { error: "NOT_FOUND" });
  if (!existsSync(DIST)) { res.writeHead(503); return res.end("Frontend build missing. Run npm run build."); }
  if (req.method === "HEAD") { res.writeHead(200); return res.end(); }
  return serveStatic(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Houshyar Iran node listening on port " + PORT);
});
