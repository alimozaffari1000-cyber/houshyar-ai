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
