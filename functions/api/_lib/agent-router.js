const AGENTS = Object.freeze({
  general: { id: "general", label: "دستیار عمومی", labelEn: "General assistant", instruction: "به‌عنوان دستیار عمومی، پاسخ دقیق و کاربردی بده. اگر اطلاعات کافی نیست، فرض‌ها را شفاف کن." },
  research: { id: "research", label: "پژوهشگر", labelEn: "Research specialist", instruction: "مسئله را پژوهش‌محور بررسی کن؛ واقعیت، فرضیه و تحلیل را جدا کن. منبع یا داده زنده‌ای را که واقعاً در اختیار نداری جعل نکن و محدودیت تازگی اطلاعات را اعلام کن." },
  analyst: { id: "analyst", label: "تحلیلگر", labelEn: "Analyst", instruction: "تحلیل را ساختاریافته ارائه کن؛ فرض‌ها، روش محاسبه، سناریوها، ریسک‌ها و عدم‌قطعیت را مشخص کن. توصیه مالی را قطعی یا تضمینی جلوه نده." },
  content: { id: "content", label: "نویسنده محتوا", labelEn: "Content writer", instruction: "روی کیفیت نگارش، ساختار، مخاطب و لحن تمرکز کن. اگر کاربر متن قابل ارسال می‌خواهد، خروجی نهایی و آماده استفاده بده." },
  translator: { id: "translator", label: "مترجم چندزبانه", labelEn: "Multilingual translator", instruction: "معنا، لحن و اصطلاحات تخصصی را حفظ کن. اگر زبان مقصد مشخص نیست و از متن قابل تشخیص نیست، یک سؤال روشن بپرس." },
  planner: { id: "planner", label: "برنامه‌ریز", labelEn: "Planner", instruction: "هدف را به مراحل اجرایی، اولویت‌ها، وابستگی‌ها و معیار پایان تقسیم کن. برنامه را واقع‌بینانه و قابل پیگیری نگه دار." },
  developer: { id: "developer", label: "برنامه‌نویس", labelEn: "Developer", instruction: "راه‌حل فنی قابل نگهداری ارائه کن؛ امنیت، اعتبارسنجی ورودی، مدیریت خطا و تست را در نظر بگیر. ادعا نکن کدی اجرا یا مستقر شده مگر واقعاً اجرا یا مستقر شده باشد." },
  commerce: { id: "commerce", label: "راهنمای خرید و خدمات محلی", labelEn: "Shopping and local services", instruction: "نیاز خرید یا خدمت را به ویژگی‌های قابل‌فیلتر تبدیل کن؛ نزدیکی، قیمت، موجودی، ارسال و تحویل حضوری را جداگانه بررسی کن. بدون داده مکانی یا اتصال واقعی، فروشگاه، موجودی، قیمت یا امکان ارسال را جعل نکن." },
  visual_designer: { id: "visual_designer", label: "طراح بصری", labelEn: "Visual design specialist", instruction: "برای طراحی بصری، چیدمان، انتخاب رنگ و تجسم محصول روی تصویر، ورودی‌ها و محدودیت‌ها را مشخص کن. بین ساخت توضیح/پرامپت و ویرایش واقعی تصویر تمایز بگذار و ادعای تولید تصویر نکن مگر ابزار تصویر واقعاً در دسترس باشد." },
  educator: { id: "educator", label: "آموزگار", labelEn: "Learning coach", instruction: "مطلب را متناسب با سطح مخاطب، مرحله‌به‌مرحله و با مثال آموزش بده؛ در پایان یک تمرین کوتاه یا راه سنجش یادگیری ارائه کن." },
  security: { id: "security", label: "کارشناس امنیت", labelEn: "Security specialist", instruction: "تهدیدها را بر اساس احتمال و اثر اولویت‌بندی کن؛ دفاع چندلایه، حداقل دسترسی، اعتبارسنجی ورودی، مدیریت اسرار و ثبت رخداد را در نظر بگیر. از ارائه دستورالعمل سوءاستفاده عملیاتی یا ادعای اسکن واقعی بدون ابزار خودداری کن." }
});

const RULES = [
  ["translator", /ترجمه|مترجم|translate|translation|traduc|übersetz|çevir|перевод|翻译|ترجم/iu],
  ["security", /امنیت|هک|نفوذ|آسیب.?پذیر|بدافزار|فیشینگ|رمز عبور|security|cybersecurity|vulnerabilit|penetration test/iu],
  ["visual_designer", /روی عکس|داخل عکس|تغییر دکور|چیدمان|مبلمان|مبل|پرو مجازی|لباس.{0,20}عکس|عکس.{0,20}لباس|طراحی بصری|رنگ.?بندی|visual design|virtual try.?on|room design/iu],
  ["commerce", /نزدیک.?ترین|نزدیک من|اطراف من|فروشگاه|مغازه|میوه.?فروشی|خرید|سفارش|تحویل|ارسال کالا|موجودی محصول|local shop|nearby store|grocery|shopping|delivery/iu],
  ["educator", /آموزش|یاد بده|یادگیری|درس بده|توضیح بده.{0,20}مثال|تمرین|امتحان|آموزگار|teach me|learning|lesson|tutorial/iu],
  ["developer", /کدنویسی|برنامه.?نویسی|باگ|خطای کد|api|javascript|python|typescript|sql|code review|debug|coding|programming/iu],
  ["analyst", /تحلیل|مقایسه|محاسبه|بازده|سرمایه.?گذاری|سهام|رمزارز|ارز دیجیتال|ریسک|آمار|داده.?ها|analy[sz]e|compare|calculate|investment|stock|crypto/iu],
  ["research", /تحقیق|پژوهش|بررسی کن|جستجو|منابع|آخرین وضعیت|research|look up|sources|latest information/iu],
  ["content", /بنویس|بازنویسی|ویرایش متن|کپشن|مقاله|ایمیل|متن تبلیغ|write|rewrite|edit this|caption|article|email draft/iu],
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
