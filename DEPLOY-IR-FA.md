# راه‌اندازی نسخه داخلی هوش‌یار روی سرور ایران

این مسیر، یک استقرار مستقل Node.js برای کاربران داخل ایران فراهم می‌کند و نسخه Cloudflare را دست‌نخورده نگه می‌دارد. برنامه داخلی فایل‌های رابط را از `dist` ارائه می‌کند و مسیر `/api/chat` را روی همان دامنه به API داخلی متصل می‌کند؛ بنابراین مرورگر برای چت به Cloudflare وابسته نیست.

## وضعیت و محدودیت‌های نسخه اول

- رابط اصلی و چت متنی با موتورهای Groq، Claude، Gemini و DeepSeek از طریق کلیدهای سرور پشتیبانی می‌شوند.
- فایل‌های کلید فقط در متغیرهای محیطی سرور قرار می‌گیرند؛ هرگز در مرورگر یا Git ذخیره نشوند.
- مقایسه هم‌زمان دو مدل در این نسخه داخلی هنوز پشتیبانی نشده است.
- API حساب کاربری، نشست‌ها، D1، تاریخچه ابری، تأیید ایمیل، بازیابی رمز و سهمیه‌بندی Cloudflare هنوز به backend داخلی منتقل نشده‌اند. تا زمان انتقال و آزمون مستقل، ورود/ثبت‌نام را در نسخه داخلی فعال یا تبلیغ نکنید.
- قابلیت‌های وابسته به سرویس بیرونی (از جمله مدل‌های AI) فقط وقتی کار می‌کنند که خود سرور ایران بتواند به API همان ارائه‌دهنده وصل شود. میزبانی داخل ایران به‌تنهایی این دسترسی را تضمین نمی‌کند.
- محدودیت درخواست در نسخه فعلی حافظه‌ای و تک‌نمونه‌ای است؛ برای چند نمونه باید Redis یا محدودسازی در Nginx اضافه شود.

## نیازمندی‌های سرور

- VPS لینوکسی در دیتاسنتر ایران
- Node.js 20 یا جدیدتر
- دامنه (ترجیحاً دامنه اختصاصی؛ برای شروع می‌توان IP را تست کرد، اما HTTPS با IP مناسب همه مرورگرها/سرویس‌ها نیست)
- Nginx و گواهی TLS معتبر برای دامنه
- دسترسی خروجی سرور به API ارائه‌دهنده انتخابی

## استقرار

از ریشه مخزن:

```bash
npm ci
npm run build
```

سپس کل مخزن (یا حداقل `dist/`, `server/`, `functions/api/_lib/`, `package.json`) را روی سرور قرار دهید و متغیرهای محیطی را تنظیم کنید:

```bash
NODE_ENV=production
PORT=3000
IR_RATE_LIMIT_PER_MINUTE=12
GROQ_API_KEY=...
# یا یکی از این‌ها:
# CLAUDE_API_KEY=...
# GEMINI_API_KEY=...
# DEEPSEEK_API_KEY=...
```

اجرای آزمایشی:

```bash
npm run start:iran
```

آدرس سلامت API:

```
GET https://YOUR-DOMAIN/api/chat
```

در پاسخ باید `status: ready` و دست‌کم یک ارائه‌دهنده با `available: true` دیده شود. این فقط سلامت پیکربندی را نشان می‌دهد؛ یک پیام آزمایشی واقعی نیز باید ارسال شود.

## اجرای پایدار با systemd

فایل `/etc/systemd/system/houshyar-iran.service` را بسازید و مسیرها را با مسیر واقعی پروژه جایگزین کنید:

```ini
[Unit]
Description=Houshyar AI Iran Node
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/houshyar-ai
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/etc/houshyar/houshyar.env
ExecStart=/usr/bin/npm run start:iran
Restart=always
RestartSec=5
User=houshyar
Group=houshyar
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

فایل محیطی را با مجوز محدود بسازید:

```bash
sudo install -d -m 700 /etc/houshyar
sudo chmod 600 /etc/houshyar/houshyar.env
sudo systemctl daemon-reload
sudo systemctl enable --now houshyar-iran
sudo systemctl status houshyar-iran
```

## Nginx و HTTPS

Nginx را طوری پیکربندی کنید که تمام مسیرهای سایت را به برنامه روی `127.0.0.1:3000` بفرستد. پورت 3000 را در فایروال عمومی باز نکنید. در reverse proxy، هدر `X-Forwarded-For` را با IP واقعی کاربر جایگزین کنید؛ اگر بعداً rate limit بر اساس IP پشت پراکسی فعال شد، باید اعتماد به پراکسی به‌صورت صریح و محدود پیاده شود. TLS را با گواهی معتبر فعال کنید.

## گیت‌های قبل از انتشار عمومی

1. تست از همراه اول، ایرانسل، مخابرات و حداقل یک ISP دیگر.
2. تست HTTPS، مسیر چت، timeout، خطاهای provider و محدودیت نرخ.
3. تست عدم افشای کلید API در فایل‌های `dist` و پاسخ‌های HTTP.
4. انتقال امن auth/D1 به دیتابیس داخلی و آزمون جداسازی حساب‌ها پیش از فعال‌کردن ورود.
5. پشتیبان‌گیری، پایش uptime و ثبت خطا بدون ذخیره متن خصوصی گفتگوها.
6. مقایسه نسخه داخلی و Cloudflare؛ هیچ تضمین دائمی برای دسترسی همه ISPها وجود ندارد.

## بازگشت به نسخه بین‌المللی

نسخه Cloudflare مستقل باقی می‌ماند. پس از تست، می‌توان یک زیردامنه مثل `ir.example.ir` را به سرور ایران متصل کرد و دامنه اصلی را برای نسخه بین‌المللی نگه داشت. تغییر DNS و خرید دامنه/سرور باید بعد از انتخاب ارائه‌دهنده و تأیید هزینه انجام شود.
