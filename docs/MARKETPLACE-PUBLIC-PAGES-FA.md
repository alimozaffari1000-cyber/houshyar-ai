# اتصال تصاویر به کالاها و صفحات عمومی بازار

Migration شماره 0011 را پس از 0010 روی D1 اجرا کنید.

آپلود تصویر: POST /api/market/images/upload با multipart fields شامل image و storeId و country. پاسخ شامل imageId است. هنگام ساخت آگهی، این شناسه‌ها را در imageIds (حداکثر ۶ مورد) ارسال کنید.

API عمومی:
- GET /api/market/listings/:id?country=IR برای آگهی منتشرشده
- GET /api/market/stores/public?country=IR&slug=shop-slug برای فروشگاه فعال و آگهی‌های آن
- GET /api/market/images/:id فقط برای تصویری که به آگهی منتشرشده در فروشگاه فعال متصل باشد

Cloudflare Pages نیازمند D1 binding با نام DB و R2 binding با نام R2_BUCKET است.
