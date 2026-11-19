# Security Policy

## Supported versions

Security fixes are currently targeted at the latest code on the `main` branch. Older commits and preview deployments are not guaranteed to receive security fixes. A release is supported only when its release notes explicitly say so.

## Reporting a vulnerability

Please do not disclose exploitable vulnerability details in public GitHub issues, discussions, pull requests, or screenshots.

1. If GitHub's **Report a vulnerability** option is available in this repository's Security tab, use it to send a private report.
2. If private vulnerability reporting is unavailable, contact the repository maintainer through a verified private channel associated with the repository owner. Do not publish proof-of-concept details while seeking that channel.
3. Include the affected commit or version, affected component or endpoint, impact, prerequisites, and concise reproduction steps. A minimal proof of concept is useful when it does not expose real data or disrupt a service.
4. Do not include passwords, API keys, access tokens, session cookies, private user data, or production secrets in a report. If a credential has been exposed, notify the maintainer privately and rotate it through the credential owner's normal process.

There is no guaranteed response or remediation SLA. Reports are triaged according to impact, reproducibility, and the affected deployment surface. Please allow time for investigation and coordinated disclosure; do not publish details before a fix or an agreed disclosure date.

## Testing boundaries

- Test only systems and accounts you own or have explicit permission to assess.
- Do not access, modify, or retain another user's data.
- Do not perform denial-of-service, destructive, persistence, or high-volume testing against live services.
- Stop testing and report privately if you encounter data outside your authorization.
- Do not change Cloudflare settings, production data, or third-party provider accounts as part of a report.

## Scope

This policy covers security defects in code and configuration maintained in this repository, including the web client, Cloudflare Pages Functions, API routes, database query handling, and GitHub Actions workflows.

Third-party services and their account configurations are not controlled by this repository. Reports about a provider should identify the relevant integration boundary and should also follow that provider's own security reporting policy.

---

# سیاست امنیتی — خلاصه فارسی

- در حال حاضر، هدف اصلاحات امنیتی آخرین کد شاخه `main` است؛ پشتیبانی از نسخه‌های قدیمی یا پیش‌نمایش‌ها تضمین نمی‌شود.
- جزئیات آسیب‌پذیری قابل بهره‌برداری را در Issue، Discussion یا Pull Request عمومی منتشر نکنید.
- اگر گزینه **Report a vulnerability** در بخش Security مخزن فعال است، گزارش را به‌صورت خصوصی ارسال کنید. در غیر این صورت، از یک مسیر خصوصی و تأییدشده برای تماس با نگه‌دارنده مخزن استفاده کنید.
- گزارش باید commit یا نسخه، مؤلفه آسیب‌پذیر، اثر، پیش‌شرط‌ها و مراحل بازتولید را مشخص کند.
- رمز عبور، کلید API، توکن، کوکی نشست، اطلاعات خصوصی کاربران یا Secretهای Production را در گزارش قرار ندهید.
- فقط سامانه‌ها و حساب‌هایی را آزمایش کنید که مالک آن هستید یا مجوز صریح دارید. آزمون مخرب، پرترافیک یا دسترسی به داده دیگران مجاز نیست.
- برای پاسخ یا رفع آسیب‌پذیری زمان تضمین‌شده‌ای وجود ندارد؛ افشای عمومی باید تا رفع مشکل یا توافق بر سر زمان افشا به تعویق بیفتد.
- این سند کانال خصوصی گزارش‌دهی را فعال نمی‌کند، مجوزهای GitHub را تغییر نمی‌دهد و به‌تنهایی به معنی ممیزی یا انطباق امنیتی پروژه نیست.
