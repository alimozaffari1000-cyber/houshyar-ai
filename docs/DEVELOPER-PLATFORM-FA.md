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


## پنل مدیریت وظایف عامل‌ها

در شاخه توسعه، پنل «وظایف عامل‌ها» به رابط اصلی افزوده شده است. این پنل از API صف وظایف استفاده می‌کند و برای ثبت/مشاهده وظایف به نشست معتبر کاربر و اتصال D1 نیاز دارد.

- کاربر می‌تواند عنوان، شرح، عامل مسئول و اولویت را ثبت کند.
- فهرست وظایف فقط برای همان کاربر از `GET /api/agent-tasks` دریافت می‌شود.
- ثبت با `POST /api/agent-tasks`، محدودیت اندازه ورودی و کلید idempotency انجام می‌شود.
- داده‌های برگشتی به‌صورت متن امن در DOM نمایش داده می‌شوند.
- در صورت نبود نشست، پنل پیام ورود نشان می‌دهد.
- وضعیت `queued` فقط به معنی ثبت در صف است؛ این پنل ادعای اجرای خودکار یا تکمیل وظیفه ندارد.
- لغو، اجرای واقعی، زمان‌بندی و تأیید انسانی متصل به حساب هنوز پیاده‌سازی نشده‌اند.
