# تأیید ایمیل و بازیابی رمز عبور هوش‌یار

این مرحله به‌صورت پیش‌فرض خاموش است و تا زمان تکمیل تنظیمات نباید `AUTH_ENABLED=true` شود.

## تنظیمات موردنیاز در Cloudflare

سه متغیر محرمانه و دو متغیر پیکربندی لازم است:

- `EMAIL_API_URL`: نشانی HTTPS سرویس ارسال ایمیل که قرارداد JSON زیر را می‌پذیرد.
- `EMAIL_API_KEY`: کلید محرمانه سرویس؛ فقط در Cloudflare Secret ذخیره شود.
- `EMAIL_FROM`: فرستنده تأییدشده، مانند `Houshyar <no-reply@example.com>`.
- `APP_BASE_URL`: دامنه اصلی HTTPS سایت، بدون مسیر.
- `AUTH_ENABLED=true`: فقط پس از اعمال تمام migrationها و تست محیط production.

هوش‌یار به‌صورت پیش‌فرض به ارائه‌دهنده خاصی وابسته نیست. آداپتور ایمیل یک درخواست POST با هدر `Authorization: Bearer <key>` و بدنه زیر ارسال می‌کند:

```json
{
  "from": "Houshyar <no-reply@example.com>",
  "to": "user@example.com",
  "subject": "موضوع پیام",
  "text": "متن ساده ایمیل"
}
```

سرویس ایمیل باید پاسخ HTTP موفق برگرداند. آدرس API باید HTTPS باشد. هیچ کلید یا رمز ایمیل را در GitHub، کد یا فایل تنظیمات عمومی قرار ندهید.

## مسیرهای امنیتی

- ثبت‌نام: حساب با وضعیت `pending` ساخته می‌شود و تا تأیید ایمیل امکان ورود ندارد.
- تأیید: توکن تصادفی ۲۵۶ بیتی با عمر ۲۴ ساعت صادر می‌شود؛ فقط hash آن در D1 ذخیره می‌شود. توکن در fragment نشانی (`#...`) قرار می‌گیرد تا در درخواست HTTP و Referrer ارسال نشود؛ کاربر باید دکمه تأیید را خودش بزند.
- ارسال دوباره تأیید: پاسخ عمومی برای جلوگیری از افشای وجود حساب.
- بازیابی رمز: پاسخ عمومی و توکن یک‌بارمصرف با عمر ۳۰ دقیقه.
- تغییر رمز: توکن مصرف و تمام نشست‌های قبلی باطل می‌شوند.
- محدودیت درخواست‌ها: هر مسیر دارای bucket مستقل IP و ایمیل در بازه ۱۵ دقیقه است.

## Migration

پس از اعمال migrationهای 0001 تا 0003 روی D1، برای پاک‌سازی دوره‌ای می‌توان این دستورها را با زمان‌بند امن Cloudflare اجرا کرد:

```sql
DELETE FROM email_verification_tokens WHERE expires_at <= unixepoch() OR consumed_at IS NOT NULL;
DELETE FROM password_reset_tokens WHERE expires_at <= unixepoch() OR consumed_at IS NOT NULL;
DELETE FROM sessions WHERE expires_at <= unixepoch() OR revoked_at IS NOT NULL;
DELETE FROM api_rate_limits WHERE expires_at <= unixepoch();
```

این دستورات را فقط با D1 binding معتبر و در عملیات زمان‌بندی‌شده مورداعتماد اجرا کنید. زمان‌بندی پاک‌سازی هنوز در این مخزن پیکربندی نشده است.

## محدودیت عملیاتی

این کد به‌تنهایی سرویس ایمیل یا دامنه را ایجاد نمی‌کند. تا وقتی سرویس ایمیل سازگار، secrets، دامنه HTTPS و migrationها در Cloudflare تنظیم و آزمایش نشده‌اند، `AUTH_ENABLED` و `CHAT_QUOTA_ENABLED` را در production فعال نکنید. ارسال ایمیل در صورت شکست با پاسخ عمومی مدیریت می‌شود تا وجود حساب افشا نشود؛ کاربر می‌تواند ارسال مجدد را امتحان کند.
