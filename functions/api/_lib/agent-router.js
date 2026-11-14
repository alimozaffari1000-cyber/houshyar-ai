const AGENTS = Object.freeze({
  general: { id: "general", label: "دستیار عمومی", labelEn: "General assistant", instruction: "به‌عنوان دستیار عمومی، پاسخ دقیق و کاربردی بده. اگر اطلاعات کافی نیست، فرض‌ها را شفاف کن." },
  research: { id: "research", label: "پژوهشگر", labelEn: "Research specialist", instruction: "مسئله را پژوهش‌محور بررسی کن؛ واقعیت، فرضیه و تحلیل را جدا کن. منبع یا داده زنده‌ای را که واقعاً در اختیار نداری جعل نکن و محدودیت تازگی اطلاعات را اعلام کن." },
  analyst: { id: "analyst", label: "تحلیلگر", labelEn: "Analyst", instruction: "تحلیل را ساختاریافته ارائه کن؛ فرض‌ها، روش محاسبه، سناریوها، ریسک‌ها و عدم‌قطعیت را مشخص کن. توصیه مالی را قطعی یا تضمینی جلوه نده." },
  content: { id: "content", label: "نویسنده محتوا", labelEn: "Content writer", instruction: "روی کیفیت نگارش، ساختار، مخاطب و لحن تمرکز کن. اگر کاربر متن قابل ارسال می‌خواهد، خروجی نهایی و آماده استفاده بده." },
  translator: { id: "translator", label: "مترجم چندزبانه", labelEn: "Multilingual translator", instruction: "معنا، لحن و اصطلاحات تخصصی را حفظ کن. اگر زبان مقصد مشخص نیست و از متن قابل تشخیص نیست، یک سؤال روشن بپرس." },
  planner: { id: "planner", label: "برنامه‌ریز", labelEn: "Planner", instruction: "هدف را به مراحل اجرایی، اولویت‌ها، وابستگی‌ها و معیار پایان تقسیم کن. برنامه را واقع‌بینانه و قابل پیگیری نگه دار." },
  developer: { id: "developer", label: "برنامه‌نویس", labelEn: "Developer", instruction: "راه‌حل فنی قابل نگهداری ارائه کن؛ امنیت، اعتبارسنجی ورودی، مدیریت خطا و تست را در نظر بگیر. ادعا نکن کدی اجرا یا مستقر شده مگر واقعاً اجرا شده باشد." }
});
const REVIEW_ROLES = Object.freeze({
  security: { id: "security", label: "بازبین امنیت", labelEn: "Security reviewer", instruction: "از منظر امنیت، حریم خصوصی، حداقل‌سازی دسترسی، اعتبارسنجی ورودی و سوءاستفاده احتمالی بررسی کن." },
  quality: { id: "quality", label: "بازبین کیفیت", labelEn: "Quality reviewer", instruction: "از منظر صحت، کامل‌بودن، تناقض‌ها، قابلیت اجرا و معیارهای پذیرش پاسخ را بازبینی کن." },
  risk: { id: "risk", label: "بازبین ریسک", labelEn: "Risk reviewer", instruction: "فرض‌های پنهان، ریسک‌ها، هزینه‌ها، پیامدهای ناخواسته و عدم‌قطعیت را بررسی کن." }
});
const RULES = [
  ["translator", /ترجمه|مترجم|translate|translation|traduc|übersetz|çevir|перевод|翻译|ترجم/iu],
  ["developer", /کدنویسی|برنامه.?نویسی|باگ|خطای کد|api|javascript|python|typescript|sql|code review|debug|coding|programming/iu],
  ["analyst", /تحلیل|مقایسه|محاسبه|بازده|سرمایه.?گذاری|سهام|رمزارز|ارز دیجیتال|ریسک|آمار|داده.?ها|analy[sz]e|compare|calculate|investment|stock|crypto/iu],
  ["research", /تحقیق|پژوهش|بررسی کن|جستجو|منابع|آخرین وضعیت|research|look up|sources|latest information/iu],
  ["content", /بنویس|بازنویسی|ویرایش متن|کپشن|مقاله|ایمیل|متن تبلیغ|write|rewrite|edit this|caption|article|email draft/iu],
  ["planner", /برنامه.?ریزی|نقشه.?راه|مرحله.?به.?مرحله|زمان.?بندی|برنامه بده|roadmap|plan|schedule|organize/iu]
];
export function routeAgentRequest(message) {
  const text = typeof message === "string" ? message.slice(0, 6000) : "";
  const match = RULES.find(([, pattern]) => pattern.test(text));
  const primary = AGENTS[match?.[0] || "general"];
  const team = [{ id: primary.id, label: primary.label, labelEn: primary.labelEn, role: "lead" }];
  const addReviewer = reviewer => {
    if (!team.some(member => member.id === reviewer.id)) team.push({ id: reviewer.id, label: reviewer.label, labelEn: reviewer.labelEn, role: "reviewer" });
  };
  if (primary.id === "developer") { addReviewer(REVIEW_ROLES.security); addReviewer(REVIEW_ROLES.quality); }
  else if (primary.id === "research" || primary.id === "analyst" || primary.id === "planner") { addReviewer(REVIEW_ROLES.risk); addReviewer(REVIEW_ROLES.quality); }
  else addReviewer(REVIEW_ROLES.quality);
  const complexTask = /کامل|از صفر|پروژه|طراحی|راه.?اندازی|پیاده.?سازی|برنامه جامع|comprehensive|from scratch|project|implement|architecture/iu.test(text);
  if (complexTask) addReviewer(REVIEW_ROLES.risk);
  const reviewerInstructions = team.slice(1).map(member => REVIEW_ROLES[member.id].instruction);
  return {
    ...primary, team, coordinationMode: "single_model_coordinated_roles", autonomousTools: false,
    instruction: [primary.instruction, "هماهنگ‌کننده مرکزی: هدف و محدودیت‌ها را استخراج کن، سپس پاسخ را از دید نقش اصلی بساز.", ...reviewerInstructions,
      "نقش‌های بازبین، دیدگاه‌های داخلی در همین پاسخ هستند و مدل یا عامل مستقل جداگانه‌ای اجرا نشده است. اختلاف‌ها را حل کن و یک پاسخ نهایی منسجم بده. اقدام بیرونی یا اجرای ابزار را ادعا نکن مگر واقعاً انجام شده باشد."
    ].join("\n")
  };
}
export function listAgents() {
  return [
    ...Object.values(AGENTS).map(({ id, label, labelEn }) => ({ id, label, labelEn, status: "available", role: "specialist" })),
    ...Object.values(REVIEW_ROLES).map(({ id, label, labelEn }) => ({ id, label, labelEn, status: "review_role", role: "reviewer" }))
  ];
}
