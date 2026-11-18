## معماری جامع پروژه

سند مادر معماری، تمام ماژول‌های طراحی‌شده، اصول فنی/امنیتی و نقشه اجرای مرحله‌ای را در [`docs/MASTER-ARCHITECTURE-FA.md`](docs/MASTER-ARCHITECTURE-FA.md) ثبت می‌کند. این سند نقشه طراحی است و به‌تنهایی به معنی فعال‌شدن قابلیت‌ها نیست.

# Houshyar AI

هوش‌یار یک دستیار هوش مصنوعی چندمنظوره، فارسی‌محور و راست‌به‌چپ است که با Vite و Cloudflare Pages Functions ساخته می‌شود.

## وضعیت واقعی شاخه اصلی و شاخه توسعه

موارد زیر وضعیت کد شاخه `main` را توصیف می‌کنند؛ قابلیت‌های جدید صف عامل‌ها و چرخه عمر آن در شاخه توسعه و PR شماره 113 قرار دارند و تا زمان ادغام، جزو نسخه اصلی محسوب نمی‌شوند.

- اتصال سمت سرور به سه ارائه‌دهنده در کد وجود دارد: Groq، Claude / Anthropic و Google Gemini؛ فعال‌بودن هرکدام به Secret معتبر در Cloudflare وابسته است.
- جست‌وجوی وب Google برای درخواست‌های Gemini به‌صورت اختیاری پیاده‌سازی شده است؛ منبع‌ها فقط وقتی نمایش داده می‌شوند که Gemini اطلاعات grounding برگرداند.
- PR شماره 94 در 2026-11-17 در شاخه main ادغام شد؛ این ادغام به‌تنهایی اثبات انتشار موفق روی دامنه اصلی نیست.
- پایه D1، احراز هویت، نشست‌ها، جداسازی حساب‌ها، محدودیت نرخ، سهمیه روزانه، تأیید ایمیل و بازیابی رمز در کد شاخه اصلی وجود دارند.
- این قابلیت‌ها در production فعال نیستند تا D1، migrationها، secrets، سرویس ایمیل و تست end-to-end در Cloudflare پیکربندی و تأیید شوند.
- رابط چندزبانه پایه برای ۱۲ زبان وجود دارد؛ این به معنی ترجمه کامل همه زبان‌های جهان نیست.
- CI شامل آزمون‌ها، بررسی امنیت، کیفیت و ساخت پروژه است؛ این بررسی‌ها جایگزین تست نفوذ مستقل نیستند.
- پرداخت رمزارزی هنوز عملیاتی نیست.
- عامل‌های QA، امنیت و کیفیت در قالب workflowهای GitHub اجرا می‌شوند؛ تیم خودمختار با اختیار تغییر و انتشار production وجود ندارد.

## امکانات موجود در کد

- رابط واکنش‌گرای چت فارسی RTL و پشتیبانی پایه چندزبانه
- مسیریابی میان Groq، Claude و Google Gemini با انتخاب خودکار یا دستی
- جست‌وجوی وب Gemini به‌صورت opt-in و نمایش حداکثر پنج منبع یکتای HTTP(S)
- محدودسازی طول پیام، تاریخچه، بدنه درخواست و timeout
- پایه API حساب کاربری، نشست امن، سهمیه و محدودیت نرخ با قابلیت فعال‌سازی کنترل‌شده
- migrationهای D1 و راهنمای راه‌اندازی/انتشار امن
- تست‌های Node.js، اسکن امنیتی، بررسی کیفیت و بودجه حجم خروجی

## توسعه محلی

نیازمند Node.js نسخه ۲۰ یا بالاتر:

```bash
npm install
npm run dev
```

## اعتبارسنجی

```bash
npm run qa
npm run agent:check
npm run security:scan
npm run build
npm run quality:check
```

## استقرار Cloudflare

این پروژه برای Cloudflare Pages است، نه Workers Builds:
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `/`
- Secretهای اختیاری سمت سرور: `GROQ_API_KEY`، `CLAUDE_API_KEY`، `GEMINI_API_KEY`

برای حساب کاربری، binding پایگاه D1 باید دقیقاً `DB` باشد و migrationهای تأییدشده به‌ترتیب روی محیط آزمایشی اجرا شوند. در شاخه توسعه فعلی migrationهای 0001 تا 0010 وجود دارند: migration شماره 0008 فقط زیرساخت داده پلتفرم توسعه‌دهندگان را اضافه می‌کند؛ migration شماره 0009 صف پایدار وظایف عامل‌ها و migration شماره 0010 فراداده چرخه عمر، idempotency و رویدادهای وظایف را تعریف می‌کنند. وجود این فایل‌ها به معنی اجرای آن‌ها روی D1 نیست؛ 0009 و 0010 هنوز باید در محیط آزمایشی، پس از تطبیق تاریخچه واقعی migrationها و تهیه نسخه پشتیبان، اعتبارسنجی شوند. هیچ‌کدام API عمومی توسعه‌دهندگان، اجرای افزونه یا پرداخت را فعال نمی‌کنند. پیش از اجرای هر migration روی Production، تاریخچه واقعی D1 و ترتیب migrationها باید با نسخه مخزن تطبیق داده شود. برای تأیید ایمیل، سرویس HTTPS و secrets مربوطه لازم است. راهنمای کامل در `CLOUDFLARE-SETUP-FA.md` است.

## مترجم ۱۰۰ زبانه — شاخه توسعه

در رابط مترجم این شاخه، فهرست انتخاب زبان مبدأ و مقصد با ۱۰۰ گزینه کدگذاری‌شده اضافه شده است؛ تشخیص خودکار زبان مبدأ نیز قابل انتخاب است. این قابلیت از مدل زبانی پیکربندی‌شده در چت استفاده می‌کند و به‌معنی تضمین کیفیت یکسان برای تمام زبان‌ها، داشتن موتور ترجمه مستقل یا پوشش کامل گویش‌ها نیست. کیفیت باید با مجموعه‌داده‌های ارزیابی و بازبینی انسانی برای هر زبان سنجیده شود.

## پلتفرم توسعه‌دهندگان

زیرساخت اولیه پروفایل توسعه‌دهنده، پروژه‌ها، کلیدهای API هش‌شده و قابل لغو، فهرست افزونه‌ها، نسخه‌ها و دفتر مصرف در `migrations/0008_developer_platform_foundation.sql` تعریف شده است. این مرحله صرفاً زیرساخت داده است؛ صدور کلید، API عمومی، اجرای کد شخص ثالث، صورتحساب و تسویه هنوز فعال نیستند. راهنمای فنی در `docs/DEVELOPER-PLATFORM-FA.md` قرار دارد.

## امنیت و انتشار

تا زمان تکمیل Pages، D1، migrationها، ایمیل، secrets و تست end-to-end، احراز هویت و سهمیه را در production فعال نکنید. هیچ کلید API یا secret را در Git، کد مرورگر، متغیرهای `VITE_*` یا گفتگو قرار ندهید.

سیاست حریم خصوصی فعلی پیش‌نویس فنی است و باید پیش از عرضه عمومی بازبینی حقوقی شود. پرداخت واقعی، پنل مدیریت کامل، پایش عملیاتی، پشتیبان‌گیری و تست نفوذ مستقل هنوز از گیت‌های انتشار هستند.


### Agent Task Queue (foundation)

The authenticated `/api/agent-tasks` endpoint lets a signed-in user create and list durable, user-owned tasks. Tasks are routed to a specialist using the existing deterministic router and stored in D1 by migration `0009_agent_task_queue.sql`. This foundation is queue-only: it does not execute agents, run user code, or perform external actions. The migration must be applied to the intended D1 database before enabling this endpoint in a deployed environment.

### Agent task lifecycle hardening

Migration `0010_agent_task_lifecycle.sql` adds retry counters, expiring lease metadata, per-user idempotency keys, and append-only task event records. Task creation records a `created` event atomically with the task row. The lifecycle policy validates legal state transitions and requires explicit human approval before resuming approval-gated work. These are execution primitives only: no queue consumer, scheduler, or autonomous worker is deployed by this change.