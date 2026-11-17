# راه‌اندازی هوش‌یار روی Cloudflare Pages

## وضعیت کد
- رابط سایت در `dist` ساخته می‌شود.
- مسیر `/api/chat` با Pages Functions اجرا می‌شود.
- کلیدهای ارائه‌دهندگان هوش مصنوعی فقط در Secret سمت سرور نگهداری می‌شوند؛ هرگز در کد فرانت‌اند یا Git قرار نمی‌گیرند.

## انتشار
1. وارد Cloudflare Dashboard شوید و Workers & Pages را باز کنید.
2. Create application → Pages → Connect to Git انتخاب کنید.
3. مخزن `alimozaffari1000-cyber/houshyar-ai` و شاخه `main` را انتخاب کنید.
4. Build command را `npm run build` و output directory را `dist` قرار دهید.
5. پس از ساخت پروژه، Settings → Variables and Secrets را باز کنید.
6. کلیدهای ارائه‌دهنده مورد استفاده را به‌صورت Secret اضافه کنید:
   - `GROQ_API_KEY` برای Groq
   - `CLAUDE_API_KEY` برای Claude / Anthropic
   - `GEMINI_API_KEY` برای Google Gemini
7. تنظیم مدل‌ها اختیاری است:
   - `GROQ_MODEL` (پیش‌فرض: `llama-3.3-70b-versatile`)
   - `CLAUDE_MODEL` (پیش‌فرض کد: `claude-sonnet-5-5`)
   - `GEMINI_MODEL` (پیش‌فرض: `gemini-2.5-flash`)
8. یک بار Deploy مجدد انجام دهید.

برای شروع، یک ارائه‌دهنده کافی است. انتخاب خودکار از تنظیمات موجود استفاده می‌کند؛ در حالت deep اگر کلید Claude موجود باشد، Claude انتخاب می‌شود. انتخاب دستی یک ارائه‌دهنده که Secret آن تنظیم نشده باشد، خطای پیکربندی می‌دهد.

## جست‌وجوی وب Google در چت
- در رابط چت، ارائه‌دهنده `Google Gemini` را انتخاب کنید.
- گزینه «جست‌وجوی وب گوگل و نمایش منابع» را فقط برای درخواست‌هایی فعال کنید که به اطلاعات تازه یا منبع وب نیاز دارند.
- این گزینه فقط برای Gemini اعمال می‌شود و به `GEMINI_API_KEY` نیاز دارد؛ Secret جداگانه‌ای برای جست‌وجو وجود ندارد.
- جست‌وجوی grounding ممکن است سهمیه یا هزینه Google AI را افزایش دهد؛ محدودیت‌های حساب و صورتحساب Google را پیش از استفاده عمومی بررسی کنید.
- حداکثر پنج منبع یکتای HTTP(S) نمایش داده می‌شود. وجود لینک منبع به‌تنهایی صحت پاسخ یا اعتبار صفحه را تضمین نمی‌کند؛ منابع مهم را بازبینی کنید.
- مقایسه دو مدل هم‌زمان با جست‌وجوی وب Gemini غیرفعال است تا مصرف ناخواسته و رفتار مبهم ایجاد نشود.

## آزمون
- `GET /api/chat` باید وضعیت سرویس و وضعیت پیکربندی ارائه‌دهندگان را برگرداند؛ این endpoint نباید مقدار Secret را نمایش دهد.
- پیام آزمایشی را از رابط سایت ارسال کنید.
- در صورت خطای 503، Secret یا تنظیمات لازم پیکربندی نشده است؛ در صورت 502، سرویس بالادستی در دسترس نیست.
- برای تأیید جست‌وجوی وب، Gemini را انتخاب و گزینه جست‌وجو را روشن کنید؛ پاسخ باید در صورت دریافت grounding metadata منابع را نمایش دهد.

## امنیت
کلیدهای API فقط در Secret سمت سرور ذخیره شوند. آن‌ها را در GitHub، فایل‌های build، متغیرهای `VITE_*` یا گفتگو قرار ندهید. برای انتشار عمومی، پیش از جذب کاربر محدودسازی نرخ درخواست، سهمیه و پایش هزینه را در محیط Production پیکربندی و end-to-end آزمایش کنید.

## رفع خطای Build در Workers Builds

این مخزن با **Cloudflare Pages** ساخته شده است؛ چون رابط سایت در `dist` تولید می‌شود و API در پوشه `functions/` به‌صورت Pages Functions اجرا می‌شود.

اگر در GitHub پیام Cloudflare لینکی با مسیر `/workers/services/view/.../builds` نشان می‌دهد، مخزن به‌عنوان **Worker** متصل شده است، نه Pages. در این حالت دستور `npx wrangler deploy` برای انتشار Worker اجرا می‌شود؛ این دستور با پیکربندی Pages این پروژه جایگزین نمی‌شود. فایل `wrangler.toml` این مخزن از `pages_build_output_dir = "./dist"` استفاده می‌کند.

### تنظیم درست

1. در Cloudflare Dashboard وارد **Workers & Pages** شوید.
2. **Create application** را انتخاب کنید.
3. نوع برنامه را **Pages** انتخاب کنید، نه Workers.
4. گزینه **Connect to Git** را بزنید و مخزن `alimozaffari1000-cyber/houshyar-ai` را انتخاب کنید.
5. شاخه انتشار را `main` قرار دهید.
6. تنظیمات Build:
   - Framework preset: `Vite` یا `None`
   - Root directory: `/`
   - Build command: `npm run build`
   - Build output directory: `dist`
7. پروژه Pages را ایجاد و اولین Deploy را اجرا کنید.

**نکته:** در پروژه Pages فیلد Deploy command مربوط به Workers Builds وجود ندارد و نباید برای آن `npx wrangler deploy` تنظیم شود. Cloudflare Pages خروجی پوشه `dist` را منتشر می‌کند و فایل‌های `functions/` را به‌عنوان Pages Functions پردازش می‌کند.

### چگونه بفهمیم نوع پروژه درست است؟

- لینک Build در GitHub باید به صفحه پروژه **Pages** مربوط باشد، نه مسیر Workers Builds.
- Build باید `npm run build` را با خروجی `dist` تمام کند.
- پس از Deploy باید دامنه `*.pages.dev` برای پروژه ساخته شود.
- سپس `/api/chat` را بررسی کنید؛ پاسخ 503 معمولاً نشان می‌دهد Secret سمت سرور هنوز تنظیم نشده است.

مستند رسمی:
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
