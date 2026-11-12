const STORAGE_KEY = "houshyar.learning.feedback.v1";
const MAX_RECORDS = 300;
const MODES = new Set(["fast", "balanced", "deep", "creative"]);
const CATEGORIES = new Set(["research", "developer", "analyst", "translator", "content", "planner", "general"]);

function readRecords(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(item =>
      item && typeof item.responseId === "string" &&
      CATEGORIES.has(item.category) && MODES.has(item.mode) &&
      (item.rating === 0 || item.rating === 1) && Number.isFinite(item.createdAt)
    ).slice(-MAX_RECORDS) : [];
  } catch { return []; }
}

export function classifyLearningTask(message = "") {
  const value = String(message).slice(0, 6000);
  if (/ترجمه|مترجم|translate|translation|traduc|übersetz|çevir|перевод|翻译|ترجم/iu.test(value)) return "translator";
  if (/کدنویسی|برنامه.?نویسی|باگ|خطای کد|api|javascript|python|typescript|sql|code review|debug|coding|programming/iu.test(value)) return "developer";
  if (/تحلیل|مقایسه|محاسبه|بازده|سرمایه.?گذاری|سهام|رمزارز|ارز دیجیتال|ریسک|آمار|داده.?ها|analy[sz]e|compare|calculate|investment|stock|crypto/iu.test(value)) return "analyst";
  if (/تحقیق|پژوهش|بررسی کن|جستجو|منابع|آخرین وضعیت|research|look up|sources|latest information/iu.test(value)) return "research";
  if (/بنویس|بازنویسی|ویرایش متن|کپشن|مقاله|ایمیل|متن تبلیغ|write|rewrite|edit this|caption|article|email draft/iu.test(value)) return "content";
  if (/برنامه.?ریزی|نقشه.?راه|مرحله.?به.?مرحله|زمان.?بندی|برنامه بده|roadmap|plan|schedule|organize/iu.test(value)) return "planner";
  return "general";
}

export function getLearningFeedback(responseId, storage = globalThis.localStorage) {
  return readRecords(storage).find(item => item.responseId === responseId)?.rating ?? null;
}

export function recordLearningFeedback({ responseId, category, mode, rating }, storage = globalThis.localStorage) {
  if (typeof responseId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(responseId)) return false;
  if (!CATEGORIES.has(category) || !MODES.has(mode) || (rating !== 0 && rating !== 1)) return false;
  try {
    const records = readRecords(storage).filter(item => item.responseId !== responseId);
    records.push({ responseId, category, mode, rating, createdAt: Date.now() });
    storage?.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
    return true;
  } catch { return false; }
}

export function getLearningStats(category, storage = globalThis.localStorage) {
  const records = readRecords(storage).filter(item => !category || item.category === category);
  return {
    total: records.length,
    positive: records.filter(item => item.rating === 1).length,
    negative: records.filter(item => item.rating === 0).length,
    byMode: Object.fromEntries([...MODES].map(mode => {
      const selected = records.filter(item => item.mode === mode);
      return [mode, { count: selected.length, positive: selected.filter(item => item.rating === 1).length }];
    }))
  };
}

export function recommendLearningMode(message, storage = globalThis.localStorage) {
  const stats = getLearningStats(classifyLearningTask(message), storage);
  if (stats.total < 3) return "balanced";
  const candidates = Object.entries(stats.byMode)
    .filter(([, value]) => value.count >= 2)
    .sort((a, b) => (b[1].positive / b[1].count) - (a[1].positive / a[1].count) || b[1].count - a[1].count);
  return candidates[0]?.[0] || "balanced";
}

export function clearLearningFeedback(storage = globalThis.localStorage) {
  try { storage?.removeItem(STORAGE_KEY); return true; } catch { return false; }
}
