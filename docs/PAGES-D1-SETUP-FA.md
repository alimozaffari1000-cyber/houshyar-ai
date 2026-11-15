# راه‌اندازی داده‌های هوش‌یار روی Cloudflare Pages + D1

این پروژه از **Cloudflare Pages برای میزبانی سایت و اجرای Pages Functions** و از **Cloudflare D1 برای ذخیره‌سازی پایدار داده‌ها** استفاده می‌کند. فایل‌های سایت در Pages قرار می‌گیرند؛ اطلاعات کاربران، نشست‌ها، سهمیه مصرف، رویدادهای امنیتی، فروشگاه‌ها و محصولات باید در D1 باشند.

## وضعیت فعلی مخزن

- پیکربندی Pages در `wrangler.toml` خروجی `dist` را مشخص می‌کند.
- APIها در مسیر `functions/api/` از binding با نام دقیق `DB` استفاده می‌کنند.
- migrationها در این ترتیب قرار دارند:
  1. `migrations/0001_identity_usage_security.sql`
  2. `migrations/0002_daily_usage_quotas.sql`
  3. `migrations/0003_email_verification_password_reset.sql`
  4. `migrations/0004_marketplace_foundation.sql`
- migration شماره ۴ ساختار فروشگاه و محصولات را اضافه می‌کند.
- در حال حاضر هیچ شناسه D1 در مخزن ثبت نشده و هیچ migration راه دوری از این مخزن اجرا نشده است.

## مرحله ۱ ـ ساخت دو پایگاه جداگانه

در Cloudflare Dashboard:

1. وارد **Storage & databases → D1 SQL Database** شوید (یا از بخش D1 در داشبورد استفاده کنید).
2. یک دیتابیس آزمایشی با نامی مانند `houshyar-ai-staging` بسازید.
3. یک دیتابیس اصلی با نامی مانند `houshyar-ai-production` بسازید.
4. شناسه هر دو دیتابیس را نگه دارید؛ شناسه محرمانه نیست، اما کلید API را هرگز در گفتگو یا Git قرار ندهید.

**هیچ‌وقت محیط آزمایشی و اصلی را به یک دیتابیس مشترک وصل نکنید.**

## مرحله ۲ ـ اتصال D1 به Pages

در پروژه Pages مربوط به `houshyar-ai`:

1. به **Settings → Functions → D1 database bindings** بروید.
2. برای محیط **Preview** یک binding اضافه کنید:
   - Variable name: `DB`
   - D1 database: `houshyar-ai-staging`
3. برای محیط **Production** یک binding جداگانه اضافه کنید:
   - Variable name: `DB`
   - D1 database: `houshyar-ai-production`
4. تنظیمات را ذخیره و هر دو محیط را مجدداً Deploy کنید.

نام binding باید دقیقاً `DB` باشد؛ نام دیگری باعث می‌شود APIهای دیتابیس نتوانند پایگاه را پیدا کنند. اگر داشبورد شما گزینه Preview را جدا نشان نمی‌دهد، از محیط Preview تا زمان تأیید binding مستقل استفاده نکنید.

## مرحله ۳ ـ اعمال migrationها

این مرحله را ابتدا فقط روی دیتابیس آزمایشی انجام دهید. در محیطی که Wrangler و دسترسی Cloudflare شما تنظیم شده، اجرا کنید:

```bash
npx wrangler@4 d1 migrations apply houshyar-ai-staging --remote
```

سپس فهرست migrationهای اجراشده را بررسی کنید:

```bash
npx wrangler@4 d1 migrations list houshyar-ai-staging --remote
```

باید هر چهار migration به ترتیب ثبت شده باشند. بعد از آن جریان‌های ثبت‌نام، ورود، نشست، سهمیه، فروشگاه، ساخت محصول و انتشار محصول را در Preview آزمایش کنید.

**توجه:** دستور apply همه migrationهای ثبت‌نشده در پوشه migrations را اجرا می‌کند. پیش از اجرا، نام دیتابیس را دوباره بررسی کنید. این دستور را با نام دیتابیس Production اجرا نکنید تا آزمون Staging و نسخه پشتیبان تأیید شده باشد.

## مرحله ۴ ـ پشتیبان‌گیری و Production

فقط پس از موفقیت کامل آزمون‌های Staging:

1. از دیتابیس Production نسخه پشتیبان تهیه کنید و امکان بازیابی آن را بررسی کنید.
2. نام دیتابیس مقصد را در دستور و داشبورد دوباره کنترل کنید.
3. migrationها را روی Production اعمال کنید:

```bash
npx wrangler@4 d1 migrations apply houshyar-ai-production --remote
npx wrangler@4 d1 migrations list houshyar-ai-production --remote
```

4. پس از Deploy، مسیرهای API و ایجاد/خواندن داده‌ها را با یک حساب آزمایشی بررسی کنید.

اگر دیتابیس Production از قبل داده دارد، پیش از هر migration باید schema و وضعیت migrationهای ثبت‌شده بررسی شود؛ اجرای کورکورانه یا حذف/بازسازی دیتابیس مجاز نیست.

## مرحله ۵ ـ کلیدها و متغیرهای سمت سرور

کلیدهای سرویس هوش مصنوعی و ایمیل فقط در **Pages → Settings → Variables and Secrets** و در محیط درست ثبت شوند. کلیدها را داخل فایل‌های مخزن، کد فرانت‌اند، پیام‌ها یا خروجی build قرار ندهید.

برای workflow پاک‌سازی امنیتی D1 در GitHub Actions، secrets موردنیاز طبق فایل `.github/workflows/d1-security-cleanup.yml` عبارت‌اند از:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_NAME`

توکن باید فقط مجوزهای لازم برای همان حساب و D1 موردنظر را داشته باشد. این workflow را تا زمان تنظیم و آزمون دسترسی محدود، فعال نکنید.

## مواردی که پس از اتصال باید آزموده شوند

- [ ] API با binding صحیح `DB` در Preview و Production بالا می‌آید.
- [ ] هر کاربر فقط فروشگاه و محصولات خودش را در داشبورد می‌بیند.
- [ ] فهرست عمومی فقط محصولات منتشرشده فروشگاه‌های فعال را نمایش می‌دهد.
- [ ] تأیید فروشگاه فقط برای مدیر مجاز است.
- [ ] داده‌های آزمایشی Preview در دیتابیس Production ظاهر نمی‌شوند.
- [ ] نسخه پشتیبان Production قابل بازیابی است.
- [ ] logها هیچ رمز، token یا کلید API را افشا نمی‌کنند.

## محدودیت دسترسی اجرایی

تغییر تنظیمات حساب Cloudflare و ساخت D1 نیازمند دسترسی مستقیم به حساب شماست. این مخزن به‌تنهایی شناسه دیتابیس یا مجوز حساب Cloudflare را ندارد؛ بنابراین این سند مراحل دقیق اتصال را آماده می‌کند، اما ادعا نمی‌کند که دیتابیس یا binding از راه دور ساخته شده است. کلید API یا رمز عبور را برای هیچ‌کس ارسال نکنید.
