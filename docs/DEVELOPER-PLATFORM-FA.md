# Houshyar Developer Platform — foundation

## Scope of this release

Migration `0008_developer_platform_foundation.sql` adds the data foundation for:
- developer profiles and review status;
- isolated development, staging, and production projects;
- revocable, expiring API credentials represented by a public prefix and a one-way secret hash;
- app listings, permission declarations, versions, and review states;
- an append-only usage ledger with idempotency support.

This is a schema foundation only. It does **not** expose developer APIs, issue credentials, execute plugins, publish apps, charge customers, or pay developers. Do not advertise these functions as live.

## Credential lifecycle requirements

1. Generate high-entropy secrets only on the server using a cryptographically secure random generator.
2. Display the secret once at creation. Persist only a one-way hash and a non-secret prefix; never log the secret.
3. Bind each credential to one project and explicit scopes. Enforce scopes on every request.
4. Support expiry, revocation, rotation, per-project quotas, and rate limits.
5. Keep production credentials separate from development credentials.
6. Never put server credentials in browser code, `VITE_*` variables, URLs, analytics, or client-visible logs.

## Marketplace release gates

An app remains private and unavailable to the public catalog until identity checks, manifest validation, permission review, dependency/security scanning, isolated runtime testing, privacy review, and an explicit publication decision are complete.

Third-party code must not run in the Pages request runtime with unrestricted access to secrets, D1, R2, or internal services. A future plugin runtime needs an isolated execution boundary and narrowly scoped capability tokens.

## Usage and billing

The usage table records metering facts, not invoices or settled money. Billing must later use a separate immutable ledger, explicit pricing versions, idempotent invoice generation, refunds/adjustments, and a payment provider that is legally available in the merchant's jurisdiction. Never infer payment success from a browser redirect; verify signed provider webhooks.

## Migration procedure

1. Confirm the D1 database binding and inspect the actual remote migration history.
2. Back up the staging database.
3. Apply migration 0008 to staging only.
4. Run schema tests and API integration tests.
5. Review constraints and indexes against the deployed D1 SQLite version.
6. Apply to production only after an explicit human approval and backup.

Do not run migrations against production merely because a file exists in the repository.


## اجرای دستی و محدود عامل‌ها در Pages

یک مسیر اجرای دستی برای وظیفه‌های صف‌شده اضافه شده است:

- مسیر `POST /api/agent-tasks/:id/run` فقط برای مالک وظیفه و با نشست معتبر قابل استفاده است.
- درخواست باید از همان origin سایت باشد؛ اجرای هر حساب با محدودیت جداگانه ۵ بار در ۱۵ دقیقه کنترل می‌شود.
- فقط هفت نقش ثابت و متن ورودی همان وظیفه به مدل فرستاده می‌شود؛ مدل هیچ ابزار، مرورگر، فایل‌سیستم یا دسترسی مستقیم به پایگاه داده ندارد.
- نشانی ارائه‌دهنده در کد ثابت و HTTPS است: `https://api.openai.com/v1/chat/completions`.
- کلید فقط باید به‌عنوان Secret سمت سرور با نام `OPENAI_API_KEY` در تنظیمات محیط Cloudflare Pages ثبت شود؛ هرگز آن را در Git، فایل `.env` قابل commit یا متغیر `VITE_*` قرار ندهید.
- نام مدل اختیاری است و با متغیر `HOUSHYAR_AGENT_MODEL` سمت سرور تنظیم می‌شود؛ پیش‌فرض `gpt-4.1-mini` است.
- اگر کلید تنظیم نشده باشد، اجرا با پاسخ `AGENT_MODEL_NOT_CONFIGURED` متوقف می‌شود.
- هر اجرا یک lease کوتاه، سقف زمان ۲۵ ثانیه، سقف خروجی، شمارنده تلاش و رویداد audit دارد. درخواست هم‌زمان برای یک وظیفه دوباره اجرا نمی‌شود.
- اجرای عامل فقط پس از کلیک صریح کاربر انجام می‌شود. این قابلیت زمان‌بندی خودکار، اجرای پس‌زمینه یا دسترسی به ابزارهای خارجی نیست.

این قابلیت فقط پس از ادغام PR پایه، اعمال migrationهای صف در محیط آزمایشی، تنظیم Secret در Cloudflare Pages و عبور تست‌های یکپارچه قابل استفاده خواهد بود. اجرای migration روی production یا تنظیم Secret تولیدی نیازمند تأیید و فرایند انتشار جداگانه است.
