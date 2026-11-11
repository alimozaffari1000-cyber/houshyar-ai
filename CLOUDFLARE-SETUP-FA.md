# راه‌اندازی هوش‌یار روی Cloudflare Pages

## وضعیت کد
- رابط سایت در `dist` ساخته می‌شود.
- مسیر `/api/chat` با Pages Functions اجرا می‌شود.
- کلید Groq فقط در Secret سمت سرور نگهداری می‌شود؛ هرگز در کد فرانت‌اند یا Git قرار نمی‌گیرد.

## انتشار
1. وارد Cloudflare Dashboard شوید و Workers & Pages را باز کنید.
2. Create application → Pages → Connect to Git انتخاب کنید.
3. مخزن `alimozaffari1000-cyber/houshyar-ai` و شاخه `main` را انتخاب کنید.
4. Build command را `npm run build` و output directory را `dist` قرار دهید.
5. پس از ساخت پروژه، Settings → Variables and Secrets را باز کنید.
6. متغیر محرمانه `GROQ_API_KEY` را اضافه کنید. مقدار آن را فقط از داشبورد رسمی Groq دریافت کنید؛ آن را در گفتگو یا Git وارد نکنید.
7. متغیر معمولی `GROQ_MODEL` اختیاری است؛ مقدار پیشنهادی `llama-3.3-70b-versatile`.
8. یک بار Deploy مجدد انجام دهید.

## آزمون
- `GET /api/chat` باید وضعیت سرویس را برگرداند.
- پیام آزمایشی را از رابط سایت ارسال کنید.
- در صورت خطای 503، Secret تنظیم نشده است؛ در صورت 502، سرویس بالادستی در دسترس نیست.

## امنیت
کلید API فقط در Secret سمت سرور ذخیره شود. برای انتشار عمومی پرترافیک، پیش از جذب کاربر محدودسازی نرخ درخواست و پایش هزینه را اضافه کنید.


## رفع خطای Build در Workers Builds

این مخزن با **Cloudflare Pages** ساخته شده است؛ چون رابط سایت در `dist` تولید می‌شود و API در پوشه `functions/` به‌صورت Pages Functions اجرا می‌شود.

اگر در GitHub پیام Cloudflare لینکی با مسیر `/workers/services/view/.../builds` نشان می‌دهد، مخزن به‌عنوان **Worker** متصل شده است، نه Pages. در این حالت دستور پیش‌فرض `npx wrangler deploy` برای انتشار Worker اجرا می‌شود؛ این دستور با پیکربندی Pages این پروژه جایگزین نمی‌شود. فایل `wrangler.toml` این مخزن از `pages_build_output_dir = "./dist"` استفاده می‌کند.

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

### کلید سرویس هوش مصنوعی

پس از ایجاد Pages project، در تنظیمات همان پروژه به **Settings → Variables and Secrets** بروید و Secret با نام `GROQ_API_KEY` را در محیط Production ثبت کنید. مقدار کلید را فقط در داشبورد Cloudflare وارد کنید؛ آن را در GitHub، فایل‌های build یا گفتگو قرار ندهید. سپس یک Deploy جدید اجرا کنید.

### چگونه بفهمیم نوع پروژه درست است؟

- لینک Build در GitHub باید به صفحه پروژه **Pages** مربوط باشد، نه مسیر Workers Builds.
- Build باید `npm run build` را با خروجی `dist` تمام کند.
- پس از Deploy باید دامنه `*.pages.dev` برای پروژه ساخته شود.
- سپس `/api/chat` را بررسی کنید؛ پاسخ 503 معمولاً نشان می‌دهد Secret سمت سرور هنوز تنظیم نشده است.

مستند رسمی تفاوت Pages و Workers Builds:
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
