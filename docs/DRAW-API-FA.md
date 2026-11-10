# وضعیت API قرعه‌کشی رایگان

این مرحله endpointهای زیر را در شاخه توسعه اضافه کرده است:

- `GET /api/draws/campaigns`: فهرست عمومی دوره‌های باز/بسته/قرعه‌کشی‌شده همراه شمارش ورودی‌های واجد شرایط و شرکت‌کنندگان یکتا.
- `GET /api/draws/campaigns?id=<uuid>`: جزئیات و شمارش یک دوره.
- `GET /api/draws/entries?campaignId=<uuid>`: بلیت‌های خود کاربر؛ نیازمند ورود.
- `POST /api/draws/entries`: ثبت ورودی رایگان؛ نیازمند ورود، کنترل Origin و rate limit؛ صدور ticket code تصادفی و idempotent به‌واسطه قید یکتایی دیتابیس.
- `POST /api/draws/admin/campaigns`: ایجاد دوره رایگان در وضعیت draft؛ فقط مدیر.

تمام endpointها تا زمانی که `DRAW_MODULE_ENABLED=true` تنظیم نشده باشد fail-closed هستند. ورود پولی از مدل داده و API ثبت ورودی مسدود است. این endpointها هنوز در UI نمایش داده نشده‌اند و به D1 migration اجراشده نیاز دارند.


## مسیرهای مدیریتی تکمیلی

- `POST /api/draws/admin/review`: مدیر می‌تواند دوره draft را باز کند یا دوره draft/scheduled/open را لغو کند.
- `POST /api/draws/admin/execute`: فقط مدیر؛ پس از پایان مهلت ثبت‌نام/رسیدن زمان قرعه‌کشی؛ انتخاب سمت سرور با seed رمزنگاری‌شده، commitment و snapshot هش‌شده.
- `POST /api/draws/admin/verify`: بازتولید انتخاب از seed و snapshot؛ نتیجهٔ راستی‌آزمایی در جدول append-only جدا ثبت می‌شود.
- `GET /api/draws/results?campaignId=<uuid>`: فقط نتیجهٔ تأییدشده را با کد بلیت برنده نشان می‌دهد؛ پیش از تأیید، کد برنده و seed افشا نمی‌شوند.

Migrationهای `0008` تا `0010` باید به ترتیب روی D1 staging اجرا و تست شوند. اجرای آن‌ها روی staging/production در این commit انجام نشده است.
