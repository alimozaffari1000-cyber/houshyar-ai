# مبنای امنیتی هوش‌یار (نسخه ۱)

این سند ممیزی ایستای مخزن در ۹ نوامبر ۲۰۲۶ را ثبت می‌کند. این بررسی، آزمون نفوذ یا تأیید امنیت محیط عملیاتی نیست.

## تغییر امنیتی این مرحله

- مجوز GitHub Actions به `contents: read` و `issues: write` محدود شد.
- اعتبارنامه checkout با `persist-credentials: false` در Git محلی runner ذخیره نمی‌شود.
- عامل تعمیر خودکار و مرحله commit/push از اجرای زمان‌بندی‌شده حذف شدند؛ CI نباید خودش کد یا پیکربندی را تغییر دهد.
- اکشن‌ها به نسخه‌های سازگار با Node.js 24 ارتقا یافتند.
- اجرای هم‌زمان تکراری لغو و زمان هر اجرا به ۱۰ دقیقه محدود شد.

## یافته‌های فنی برای مراحل بعد

### اولویت بحرانی پیش از استفاده عمومی

1. **مصرف بدون احراز هویت API:** مسیر `/api/chat` در کد فعلی احراز هویت یا سهمیه‌بندی کاربر ندارد. تا زمان افزودن کنترل سمت سرور، endpoint عمومی می‌تواند هزینه مدل را مصرف کند.
2. **محدودیت اندازه بدنه:** پیام و تاریخچه محدودیت کاراکتری دارند، اما پیش از `request.json()` سقف سخت اندازه بدنه درخواست اعمال نشده است.
3. **محدودیت نرخ و هزینه:** محدودسازی درخواست بر اساس شناسه کاربر/IP و سقف مصرف روزانه باید سمت سرور و با Durable Objects یا سازوکار مناسب Cloudflare اعمال شود.
4. **مهلت ارتباط upstream:** درخواست Groq باید timeout محدود و قابل‌آزمایش داشته باشد.
5. **سیاست دسترسی:** CORS محدود، هدرهای امنیتی و سیاست CSP باید پس از تعیین دامنه نهایی تعریف شوند.

### اولویت بالا

- اعتبارسنجی سخت‌گیرانه schema پیام و تاریخچه؛
- تست منفی برای JSON خراب، نقش نامعتبر، پیام بزرگ، پاسخ غیر JSON و خطای upstream؛
- ثبت رویدادهای عملیاتی بدون ثبت متن گفتگو، کلیدها یا داده شخصی؛
- قفل وابستگی‌ها با `package-lock.json` و استفاده از `npm ci` پس از ایجاد lockfile؛
- تست مرورگر موبایل، RTL، صفحه‌کلید، screen reader و Core Web Vitals؛
- تست مجوزهای D1 و جداسازی داده کاربران قبل از افزودن تاریخچه و حساب کاربری.

## محدودیت‌ها و موارد خارج از اختیار خودکار

- هیچ کلید، Secret یا تنظیم Cloudflare تغییر نکرده است.
- احراز هویت، پرداخت، حذف داده و مهاجرت پایگاه داده بدون بررسی و تأیید جداگانه انجام نمی‌شود.
- اسکن ایستا نبود الگوهای شناخته‌شده را بررسی می‌کند و اثبات امنیت نیست.
- انتشار Cloudflare فقط با مشاهده deployment موفق قابل تأیید است.

## منابع

- OWASP API Security Top 10: https://owasp.org/www-project-api-security/
- OWASP API4 Resource Consumption: https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/
- Cloudflare Pages Functions bindings and secrets: https://developers.cloudflare.com/pages/functions/bindings/
- GitHub Actions least privilege: https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication
