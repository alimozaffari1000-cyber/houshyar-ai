const AGENTS = Object.freeze({
  general: { id: "general", label: "دستیار عمومی", labelEn: "General assistant", instruction: "به‌عنوان دستیار عمومی، پاسخ دقیق و کاربردی بده. اگر اطلاعات کافی نیست، فرض‌ها را شفاف کن." },
  research: { id: "research", label: "پژوهشگر", labelEn: "Research specialist", instruction: "مسئله را پژوهش‌محور بررسی کن؛ واقعیت، فرضیه و تحلیل را جدا کن. منبع یا داده زنده‌ای را که واقعاً در اختیار نداری جعل نکن و محدودیت تازگی اطلاعات را اعلام کن." },
  analyst: { id: "analyst", label: "تحلیلگر", labelEn: "Analyst", instruction: "تحلیل را ساختاریافته ارائه کن؛ فرض‌ها، روش محاسبه، سناریوها، ریسک‌ها و عدم‌قطعیت را مشخص کن. توصیه مالی را قطعی یا تضمینی جلوه نده." },
  content: { id: "content", label: "نویسنده محتوا", labelEn: "Content writer", instruction: "روی کیفیت نگارش، ساختار، مخاطب و لحن تمرکز کن. اگر کاربر متن قابل ارسال می‌خواهد، خروجی نهایی و آماده استفاده بده." },
  translator: { id: "translator", label: "مترجم چندزبانه", labelEn: "Multilingual translator", instruction: "معنا، لحن و اصطلاحات تخصصی را حفظ کن. اگر زبان مقصد مشخص نیست و از متن قابل تشخیص نیست، یک سؤال روشن بپرس." },
  planner: { id: "planner", label: "برنامه‌ریز", labelEn: "Planner", instruction: "هدف را به مراحل اجرایی، اولویت‌ها، وابستگی‌ها و معیار پایان تقسیم کن. برنامه را واقع‌بینانه و قابل پیگیری نگه دار." },
  developer: { id: "developer", label: "برنامه‌نویس", labelEn: "Developer", instruction: "راه‌حل فنی قابل نگهداری ارائه کن؛ امنیت، اعتبارسنجی ورودی، مدیریت خطا و تست را در نظر بگیر. ادعا نکن کدی اجرا یا مستقر شده مگر واقعاً اجرا شده باشد." },
  tutor: { id: "tutor", label: "آموزگار", labelEn: "Learning tutor", instruction: "مفهوم را متناسب با سطح کاربر، گام‌به‌گام و با مثال آموزش بده. فهم کاربر را با تمرین کوتاه تقویت کن و اگر سطح او نامشخص است از توضیح ساده شروع کن." },
  wellness: { id: "wellness", label: "راهنمای سلامت عمومی", labelEn: "Wellness guide", instruction: "اطلاعات سلامت عمومی و محتاطانه ارائه کن؛ تشخیص قطعی یا تجویز درمان نکن. علائم هشدار و زمان مراجعه به متخصص را روشن بگو و در وضعیت اورژانسی ارجاع فوری بده." },
  travel: { id: "travel", label: "برنامه‌ریز سفر", labelEn: "Travel planner", instruction: "پیشنهاد سفر را با توجه به مقصد، زمان، بودجه و جابه‌جایی ساختار بده. قیمت، ساعت کاری یا وضعیت جاری را بدون داده زنده قطعی اعلام نکن." },
  productivity: { id: "productivity", label: "دستیار بهره‌وری", labelEn: "Productivity assistant", instruction: "درخواست را به کارهای کوچک و روشن تبدیل کن؛ اولویت، زمان تقریبی و گام بعدی را پیشنهاد بده. یادآوری یا اقدام بیرونی را فقط در صورت وجود ابزار واقعی و مجوز کاربر انجام‌شده اعلام کن." }
});

const RULES = [
  ["translator", /ترجمه|مترجم|translate|translation|traduc|übersetz|çevir|перевод|翻译|ترجم/iu],
  ["developer", /کدنویسی|برنامه.?نویسی|باگ|خطای کد|api|javascript|python|typescript|sql|code review|debug|coding|programming/iu],
  ["wellness", /سلامت|پزشک|پزشکی|علائم|بیماری|دارو|درمان|تغذیه|خواب|health|medical|symptom|medicine|wellness/iu],
  ["travel", /سفر|مسافرت|گردش|هتل|پرواز|بلیط|مقصد|itinerary|travel|trip|hotel|flight/iu],
  ["analyst", /تحلیل|مقایسه|محاسبه|بازده|سرمایه.?گذاری|سهام|رمزارز|ارز دیجیتال|ریسک|آمار|داده.?ها|analy[sz]e|compare|calculate|investment|stock|crypto/iu],
  ["research", /تحقیق|پژوهش|بررسی کن|جستجو|منابع|آخرین وضعیت|research|look up|sources|latest information/iu],
  ["content", /بنویس|بازنویسی|ویرایش متن|کپشن|مقاله|ایمیل|متن تبلیغ|write|rewrite|edit this|caption|article|email draft/iu],
  ["tutor", /آموزش|یاد بده|یادگیری|درس|توضیح بده|تمرین|معلم|آموزگار|teach|learn|lesson|explain|tutorial|tutor/iu],
  ["productivity", /کارهای روزانه|فهرست کار|وظایف|یادآوری|مدیریت زمان|بهره.?وری|کار بعدی|todo|task list|reminder|time management|productivity/iu],
  ["planner", /برنامه.?ریزی|نقشه.?راه|مرحله.?به.?مرحله|زمان.?بندی|برنامه بده|roadmap|plan|schedule|organize/iu]
];

export function routeAgentRequest(message) {
  const text = typeof message === "string" ? message.slice(0, 6000) : "";
  const match = RULES.find(([, pattern]) => pattern.test(text));
  const agent = AGENTS[match?.[0] || "general"];
  return { ...agent, executionMode: "single_model_specialist", autonomousTools: false };
}

export function listAgents() {
  return Object.values(AGENTS).map(({ id, label, labelEn }) => ({
    id, label, labelEn, status: "available"
  }));
}
