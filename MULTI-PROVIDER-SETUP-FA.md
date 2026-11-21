# اتصال چندارائه‌دهنده‌ای هوش‌یار

هوش‌یار از طریق Pages Functions می‌تواند چند ارائه‌دهنده مدل را از سمت سرور فراخوانی کند. کلیدها فقط در Cloudflare Pages Secrets ذخیره می‌شوند.

## ارائه‌دهنده‌ها

- Groq: با Secret به نام `GROQ_API_KEY` (اولویت پیش‌فرض در صورت پیکربندی)
- Anthropic Claude: با Secret به نام `CLAUDE_API_KEY`
- Google Gemini: با Secret به نام `GEMINI_API_KEY` (مدل پیش‌فرض `gemini-2.5-flash`)
- DeepSeek: با Secret به نام `DEEPSEEK_API_KEY` (مدل پیش‌فرض `deepseek-flash`)

مدل Claude پیش‌فرض در این نسخه `claude-sonnet-5-5` است. در صورت نیاز می‌توان آن را با متغیر معمولی `CLAUDE_MODEL` تغییر داد. مدل DeepSeek نیز با متغیر معمولی `DEEPSEEK_MODEL` قابل تغییر است.

## تنظیم Claude در Cloudflare Pages

1. در Cloudflare Dashboard پروژه Pages مربوط به هوش‌یار را باز کنید.
2. به Settings → Variables and Secrets → Production بروید.
3. یک Secret با نام دقیق `CLAUDE_API_KEY` ایجاد کنید و مقدار API key را از Claude Console وارد کنید.
4. در صورت تمایل متغیر معمولی `CLAUDE_MODEL` را روی `claude-sonnet-5-5` قرار دهید.
5. یک Deploy جدید اجرا کنید تا تنظیمات در محیط Production اعمال شوند.

برای دریافت API key به حساب Claude Console نیاز است: https://platform.claude.com/

## تنظیم Google Gemini در Cloudflare Pages

1. در Cloudflare Dashboard پروژه Pages هوش‌یار را باز کنید.
2. به Settings → Variables and Secrets → Production بروید.
3. یک Secret با نام دقیق `GEMINI_API_KEY` ایجاد کنید و کلید را از Google AI Studio وارد کنید.
4. در صورت نیاز متغیر معمولی `GEMINI_MODEL` را روی `gemini-2.5-flash` تنظیم کنید.
5. Deploy جدید اجرا کنید تا Secret در محیط Production فعال شود.

کلید Gemini را فقط در Cloudflare به‌صورت Secret ذخیره کنید؛ هرگز آن را در متغیرهای `VITE_*` قرار ندهید.

## تنظیم DeepSeek در Cloudflare Pages

1. در Cloudflare Dashboard پروژه Pages هوش‌یار را باز کنید.
2. به Settings → Variables and Secrets → Production بروید.
3. یک Secret با نام دقیق `DEEPSEEK_API_KEY` ایجاد کنید.
4. در صورت نیاز، متغیر معمولی `DEEPSEEK_MODEL` را روی `deepseek-flash` تنظیم کنید.
5. پس از تأیید تنظیمات، یک Deploy جدید اجرا کنید تا Secret در محیط موردنظر در دسترس Pages Functions قرار گیرد.

کلید DeepSeek فقط باید در Secret سمت سرور ذخیره شود؛ آن را در کد مرورگر، فایل `.env` قابل commit، متغیرهای `VITE_*` یا گفتگو قرار ندهید.

## رفتار انتخاب مدل

- `auto`: در حالت `deep`، اگر Claude پیکربندی شده باشد ابتدا Claude و در غیر این صورت DeepSeek انتخاب می‌شود؛ اگر هیچ‌کدام پیکربندی نشده باشند، انتخاب به مسیر پیش‌فرض برمی‌گردد. در حالت‌های دیگر، مقدار معتبر `AI_DEFAULT_PROVIDER` (یکی از `groq`، `anthropic`، `google` یا `deepseek`) انتخاب را تعیین می‌کند. اگر این متغیر معتبر نباشد، اولین ارائه‌دهنده پیکربندی‌شده با ترتیب Groq، Claude، Gemini و DeepSeek انتخاب می‌شود.
- `groq`: انتخاب صریح Groq.
- `anthropic`: انتخاب صریح Claude؛ اگر Secret تنظیم نشده باشد API با خطای پیکربندی پاسخ می‌دهد.
- `google`: انتخاب صریح Gemini؛ اگر Secret تنظیم نشده باشد API با خطای پیکربندی پاسخ می‌دهد.
- `deepseek`: انتخاب صریح DeepSeek؛ اگر Secret تنظیم نشده باشد API با خطای پیکربندی پاسخ می‌دهد. در حالت پاسخ عمیق، درخواست DeepSeek با thinking فعال ارسال می‌شود.
- مقایسه: مقایسه فعلی دو مدل Groq یا ترکیب Groq و Claude را پشتیبانی می‌کند؛ Gemini و DeepSeek در انتخاب مستقیم و پاسخ‌گویی عادی فعال‌اند و مقایسه چندارائه‌دهنده‌ای آن‌ها مرحله بعدی توسعه است.

## امنیت و هزینه

- هر درخواست به API ارائه‌دهنده می‌تواند هزینه داشته باشد؛ مقایسه دو ارائه‌دهنده تقریباً دو درخواست ایجاد می‌کند.
- کلید API را در GitHub، فایل‌های `VITE_*`، مرورگر، کد HTML یا گفتگو قرار ندهید.
- خطاهای ارائه‌دهنده به کاربر به شکل عمومی نمایش داده می‌شوند؛ پاسخ خام خطا یا کلید محرمانه بازگردانده نمی‌شود.
- افزودن یک ارائه‌دهنده جدید باید با یک adapter سمت سرور و تست مستقل انجام شود.
- فعال‌بودن هر ارائه‌دهنده در کد به معنی پیکربندی یا تأیید عملیاتی آن در Cloudflare Production نیست.

## اعتبارسنجی

```bash
npm run qa
npm run agent:check
npm run build
```

هر اتصال تا زمانی که Secret مربوطه در محیط Cloudflare ثبت و درخواست واقعی end-to-end آزمایش نشود، در وضعیت «کد آماده / اتصال عملیاتی تأییدنشده» باقی می‌ماند.

## جست‌وجوی وب Google (اختیاری)

- در رابط چت، ارائه‌دهنده `Google Gemini` را انتخاب کنید.
- گزینه «جست‌وجوی وب گوگل و نمایش منابع» را فقط برای پرسش‌هایی فعال کنید که به اطلاعات تازه یا منبع وب نیاز دارند.
- هوش‌یار ابزار Google Search grounding را فقط در درخواست‌های Gemini فعال می‌کند و منابع وبی را که خود Gemini برمی‌گرداند، پس از اعتبارسنجی پروتکل HTTP/HTTPS نمایش می‌دهد.
- این قابلیت به همان Secret سمت سرور `GEMINI_API_KEY` نیاز دارد؛ کلید جدیدی در مرورگر یا مخزن قرار ندهید.
- استفاده از جست‌وجوی grounding ممکن است سهمیه یا هزینه Google AI را افزایش دهد. محدودیت‌ها و شرایط حساب Google AI Studio را پیش از فعال‌سازی بررسی کنید.
- لینک منبع، نشانهٔ استناد مدل است و به‌تنهایی تضمین‌کنندهٔ صحت محتوای صفحه نیست؛ برای تصمیم‌های مهم، منبع را بازبینی کنید.
