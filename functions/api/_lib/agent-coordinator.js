const SPECIALISTS = Object.freeze({
  research: {
    label: "پژوهشگر",
    instruction: "فقط از زاویه پژوهش و شواهد بررسی کن؛ واقعیت، فرضیه و خلأ اطلاعات را جدا کن. منبع یا داده زنده جعل نکن."
  },
  analyst: {
    label: "تحلیلگر",
    instruction: "از زاویه تحلیل ساختاریافته بررسی کن؛ فرض‌ها، ریسک‌ها، سناریوها و عدم‌قطعیت را روشن کن."
  },
  developer: {
    label: "برنامه‌نویس",
    instruction: "از زاویه فنی بررسی کن؛ امنیت، اعتبارسنجی، خطاها، نگهداری‌پذیری و تست را در نظر بگیر."
  },
  planner: {
    label: "برنامه‌ریز",
    instruction: "از زاویه اجرا بررسی کن؛ مراحل، اولویت‌ها، وابستگی‌ها و معیار پایان را مشخص کن."
  },
  content: {
    label: "نویسنده محتوا",
    instruction: "از زاویه کیفیت محتوا، ساختار، مخاطب و وضوح بررسی کن."
  },
  translator: {
    label: "مترجم",
    instruction: "از زاویه دقت زبانی، حفظ معنا، لحن و اصطلاحات تخصصی بررسی کن."
  }
});

const SIGNALS = Object.freeze([
  ["research", /تحقیق|پژوهش|بررسی منابع|منابع معتبر|جستجو کن|research|sources/iu],
  ["analyst", /تحلیل|مقایسه|محاسبه|ریسک|سناریو|سرمایه.?گذاری|analy[sz]e|compare|calculate/iu],
  ["developer", /کدنویسی|برنامه.?نویسی|باگ|پیاده.?سازی|معماری فنی|api|javascript|python|debug|implement/iu],
  ["planner", /برنامه.?ریزی|نقشه.?راه|مرحله.?به.?مرحله|زمان.?بندی|roadmap|schedule/iu],
  ["content", /بنویس|بازنویسی|متن تبلیغ|مقاله|کپشن|write|rewrite|article/iu],
  ["translator", /ترجمه|مترجم|translate|translation|ترجمه کن/iu]
]);

const MAX_MESSAGE_CHARS = 6000;
const MAX_SPECIALISTS = 2;
const MAX_SPECIALIST_OUTPUT_CHARS = 5000;

export function planAgentTasks(message, options = {}) {
  if (typeof message !== "string" || !message.trim()) return [];
  const maxSpecialists = Math.max(1, Math.min(MAX_SPECIALISTS, Number(options.maxSpecialists) || MAX_SPECIALISTS));
  const normalized = message.trim().slice(0, MAX_MESSAGE_CHARS);
  const selected = SIGNALS
    .filter(([id, pattern]) => pattern.test(normalized))
    .map(([id]) => id)
    .slice(0, maxSpecialists);

  if (selected.length < 2) return [];
  return selected.map((agentId, index) => ({
    step: index + 1,
    agentId,
    label: SPECIALISTS[agentId].label,
    instruction: SPECIALISTS[agentId].instruction
  }));
}

/**
 * Bounded, deterministic orchestration. The executor is supplied by the API
 * layer; this module itself has no network, storage, or external side effects.
 */
export async function coordinateAgentRequest({ message, execute, maxSpecialists = MAX_SPECIALISTS } = {}) {
  if (typeof message !== "string" || !message.trim()) {
    return { coordinated: false, reason: "MESSAGE_REQUIRED", reply: null, steps: [] };
  }
  if (typeof execute !== "function") {
    throw new TypeError("An execution adapter is required.");
  }

  const original = message.trim().slice(0, MAX_MESSAGE_CHARS);
  const plan = planAgentTasks(original, { maxSpecialists });
  if (!plan.length) {
    return { coordinated: false, reason: "NO_MULTI_SPECIALIST_PLAN", reply: null, steps: [] };
  }

  const completed = [];
  const failures = [];
  for (const task of plan) {
    const prompt = [
      "درخواست اصلی کاربر:",
      original,
      "",
      "وظیفه تخصصی:",
      task.instruction,
      "فقط نکات مرتبط با تخصص خود را ارائه کن. اگر اطلاعات کافی نیست، محدودیت را صریح بگو."
    ].join("\n");

    try {
      const output = await execute({
        agentId: task.agentId,
        instruction: task.instruction,
        prompt,
        maxTokens: 450
      });
      if (typeof output !== "string" || !output.trim()) throw new Error("EMPTY_SPECIALIST_OUTPUT");
      completed.push({
        agentId: task.agentId,
        label: task.label,
        output: output.trim().slice(0, MAX_SPECIALIST_OUTPUT_CHARS)
      });
    } catch {
      failures.push({ agentId: task.agentId, code: "SPECIALIST_FAILED" });
    }
  }

  if (!completed.length) {
    return { coordinated: true, reason: "ALL_SPECIALISTS_FAILED", reply: null, steps: [], failures };
  }

  const synthesis = [
    "درخواست اصلی کاربر:",
    original,
    "",
    "خروجی متخصصان (ممکن است بعضی مراحل ناموفق باشند):",
    ...completed.map((item, index) => `${index + 1}. ${item.label} ( ${item.agentId} ):\n${item.output}`),
    "",
    "یک پاسخ نهایی یکپارچه، بدون تکرار و به زبان کاربر ارائه کن. اختلاف نظرها و محدودیت داده را پنهان نکن. خروجی متخصصان را واقعیت قطعی فرض نکن."
  ].join("\n");

  try {
    const reply = await execute({
      agentId: "general",
      instruction: "هماهنگ‌کننده و جمع‌بندی‌کننده؛ خروجی متخصصان را نقادانه ادغام کن.",
      prompt: synthesis,
      maxTokens: 900
    });
    if (typeof reply !== "string" || !reply.trim()) throw new Error("EMPTY_SYNTHESIS");
    return {
      coordinated: true,
      reason: failures.length ? "PARTIAL" : "COMPLETED",
      reply: reply.trim(),
      steps: completed.map(({ agentId }) => agentId),
      failures
    };
  } catch {
    return {
      coordinated: true,
      reason: "SYNTHESIS_FAILED",
      reply: completed.map(item => `### ${item.label}\n${item.output}`).join("\n\n"),
      steps: completed.map(({ agentId }) => agentId),
      failures: [...failures, { agentId: "general", code: "SYNTHESIS_FAILED" }]
    };
  }
}
