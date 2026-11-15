# چک‌لیست انتشار امن هوش‌یار

آخرین بازبینی: ۲۴ آبان ۱۴۰۵
ادغام کد به معنی آماده‌بودن سرویس برای کاربران واقعی نیست.

## ۱. وضعیت کد و CI

- [x] پایه D1، حساب، نشست، جداسازی داده، محدودیت نرخ، سهمیه روزانه و تأیید ایمیل/بازیابی رمز در شاخه main وجود دارد.
- [x] workflowهای QA، امنیت، کیفیت و نگهداری D1 در مخزن تعریف شده‌اند.
- [x] اجرای سبز workflowهای Guardian، Security Watch و Quality روی commit `3b948929de5a76244407a9eb85514faa69213a4a` در ۱۵ نوامبر ۲۰۲۶ بررسی شد؛ `npm run agent:check`، `npm run qa`، `npm run build`، اسکن امنیت و ممیزی کیفیت همگی در Actions موفق بودند.
  - [Guardian](https://github.com/alimozaffari1000-cyber/houshyar-ai/actions/runs/43689454769) · [Security Watch](https://github.com/alimozaffari1000-cyber/houshyar-ai/actions/runs/43689454747) · [Quality](https://github.com/alimozaffari1000-cyber/houshyar-ai/actions/runs/43689454775)
- [ ] انتشار Production در Cloudflare Pages و پاسخ زنده دامنه اصلی `houshyar-ai.pages.dev` تأیید شود.
- [ ] هر تغییر بعدی در شاخه جدا، با تست و بازبینی، سپس PR به main ارائه شود.

## ۲. آماده‌سازی Cloudflare Pages

- [ ] مخزن alimozaffari1000-cyber/houshyar-ai به‌عنوان Pages متصل باشد، نه Workers Builds.
- [ ] Branch برابر main باشد.
- [ ] Root directory برابر / باشد.
- [ ] Build command برابر npm run build باشد.
- [ ] Output directory برابر dist باشد.
- [ ] Secret سمت سرور GROQ_API_KEY در محیط Production تنظیم شود.
- [ ] پس از Deploy، دامنه pages.dev و مسیر /api/chat آزمایش شوند.

**تفکیک Preview و Production:** پیام `Deploy successful` داخل یک Pull Request فقط موفقیت همان Preview URL را ثابت می‌کند؛ به‌تنهایی اثبات نمی‌کند که دامنه اصلی `houshyar-ai.pages.dev` از آخرین commit شاخه `main` منتشر و قابل دسترسی است. برای تأیید انتشار عمومی، در Cloudflare Pages باید Deployment مربوط به شاخه Production (`main`) موفق باشد و دامنه اصلی جداگانه باز شود. خطای Worker Builds را با وضعیت Pages اشتباه نگیرید؛ بررسی اتصال تکراری در [issue 59](https://github.com/alimozaffari1000-cyber/houshyar-ai/issues/59) ثبت شده است.
- [ ] Pages Preview و Production از bindingهای D1 مستقل استفاده کنند؛ نام هر دو binding دقیقاً DB باشد.

## ۳. پایگاه D1 و migrationها

- [ ] ساخت دو D1 مستقل با نام‌های مشخص برای staging و production.
- [ ] binding دقیق DB در Pages Preview به D1 آزمایشی متصل شود.
- [ ] binding دقیق DB در Pages Production به D1 اصلی متصل شود.
- [ ] قبل از هر migration روی دیتابیس مقصد، backup تهیه و امکان بازیابی بررسی شود.
- [ ] migrationهای زیر به‌ترتیب در staging اجرا و نتیجه بررسی شوند:
  - migrations/0001_identity_usage_security.sql
  - migrations/0002_daily_usage_quotas.sql
  - migrations/0003_email_verification_password_reset.sql
  - migrations/0004_marketplace_foundation.sql
- [ ] تست ثبت‌نام، نشست، سهمیه، مالکیت فروشگاه و محصول، فهرست عمومی و تأیید مدیر در staging موفق باشد.
- [ ] فقط پس از تأیید staging و backup معتبر، migrationهای ثبت‌نشده روی production اجرا شوند.
- [ ] برای workflow پاک‌سازی D1، سه GitHub secret با نام‌های CLOUDFLARE_API_TOKEN، CLOUDFLARE_ACCOUNT_ID و CLOUDFLARE_D1_DATABASE_NAME با حداقل سطح دسترسی تنظیم و آزمایش شوند.
- [ ] پاک‌سازی دوره‌ای D1 ابتدا در محیط آزمایشی بررسی شود.

## ۴. ایمیل و فعال‌سازی حساب

- [ ] دامنه HTTPS نهایی در APP_BASE_URL تنظیم شود.
- [ ] سرویس ارسال ایمیل سازگار با قرارداد API و HTTPS آماده شود.
- [ ] EMAIL_API_URL، EMAIL_API_KEY و EMAIL_FROM فقط به‌صورت متغیر/Secret سمت سرور تنظیم شوند.
- [ ] ثبت‌نام، تأیید ایمیل، ورود، خروج، ارسال مجدد تأیید و بازیابی رمز در staging آزمایش شوند.
- [ ] انقضای توکن، یک‌بارمصرف بودن، ابطال نشست‌ها و پاسخ یکسان برای ایمیل موجود/ناموجود بررسی شوند.
- [ ] فقط پس از موفقیت همه آزمون‌ها، AUTH_ENABLED=true فعال شود.
- [ ] CHAT_QUOTA_ENABLED=true فقط پس از آزمون محدودیت نرخ و سهمیه فعال شود.

## ۵. ایمنی، هزینه و عملیات

- [ ] سقف هزینه و مصرف provider، timeout و هشدار خطا تنظیم شود.
- [ ] logها فاقد رمز، توکن خام، کلید API، متن خصوصی و IP خام باشند.
- [ ] دسترسی GitHub Actions و Cloudflare بر اساس حداقل سطح دسترسی باقی بماند.
- [ ] backup، rollback و پاسخ به رخداد امنیتی تعریف و تمرین شوند.
- [ ] تست E2E، بررسی دسترس‌پذیری و تست نفوذ مستقل انجام شود.
- [ ] سیاست حریم خصوصی و شرایط استفاده توسط فرد واجد صلاحیت بازبینی حقوقی شوند.

## ۶. معیار اجازه انتشار عمومی

انتشار عمومی فقط زمانی مجاز است که:
1. CI روی commit نهایی سبز باشد.
2. Pages، D1، migrationها، ایمیل HTTPS و secrets پیکربندی و آزمایش شده باشند.
3. جریان end-to-end حساب و چت موفق باشد.
4. محدودیت نرخ، سهمیه و کنترل هزینه در production قابل مشاهده باشند.
5. backup، rollback و پاسخ به رخداد آماده باشند.
6. بازبینی امنیتی و حقوقی انجام شده باشد.

**هشدار:** تست‌های خودکار جایگزین تست نفوذ، بازبینی حقوقی یا ارزیابی امنیت محیط واقعی نیستند. تا تکمیل موارد بالا، قابلیت حساب و سهمیه را در production فعال نکنید.

راهنمای گام‌به‌گام اتصال D1 به Pages: [docs/PAGES-D1-SETUP-FA.md](./PAGES-D1-SETUP-FA.md)
