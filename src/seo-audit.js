const MAX_HTML_LENGTH = 500_000;

function textContent(value = "") {
  return String(value).replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function attr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp("(?:^|\\s)" + escaped + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

function finding(id, severity, title, evidence, recommendation) {
  return { id, severity, title, evidence, recommendation };
}

/**
 * Analyze supplied HTML only. This function intentionally performs no network
 * requests and does not claim to measure rankings, traffic, CWV, or indexation.
 */
export function analyzeHTML(input) {
  if (typeof input !== "string" || !input.trim()) throw new TypeError("HTML_REQUIRED");
  if (input.length > MAX_HTML_LENGTH) throw new RangeError("HTML_TOO_LARGE");
  const html = input.replace(/<!--[\s\S]*?-->/g, "");
  const findings = [];
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = titleMatch ? textContent(titleMatch[1]) : "";
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]);
  const description = metas.map(tag => ({tag, name: attr(tag, "name").toLowerCase()})).find(item => item.name === "description");
  const descriptionContent = description ? attr(description.tag, "content") : "";
  const canonical = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]).filter(tag => attr(tag, "rel").toLowerCase().split(/\s+/).includes("canonical"));
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)].map(match => textContent(match[1]));
  const headings = ["h2","h3","h4","h5","h6"].map(name => ({name, count: [...html.matchAll(new RegExp("<" + name + "\\b", "gi"))].length}));
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(match => match[0]);
  const missingAlt = images.filter(tag => !attr(tag, "alt"));
  const anchors = [...html.matchAll(/<a\b[^>]*>/gi)].map(match => match[0]);
  const noHref = anchors.filter(tag => !attr(tag, "href"));
  const lang = attr((html.match(/<html\b[^>]*>/i) || [""])[0], "lang");
  const viewport = metas.some(tag => attr(tag, "name").toLowerCase() === "viewport");
  const robots = metas.find(tag => attr(tag, "name").toLowerCase() === "robots");
  const robotsContent = robots ? attr(robots, "content").toLowerCase() : "";
  const canonicalHref = canonical.length === 1 ? attr(canonical[0], "href") : "";

  if (!title) findings.push(finding("title-missing","critical","عنوان صفحه وجود ندارد","عنصر title در HTML پیدا نشد.","برای این صفحه یک عنوان یکتا، دقیق و توصیفی تعریف کنید."));
  else if (title.length < 15 || title.length > 60) findings.push(finding("title-length","warning","طول عنوان نیازمند بازبینی است",`طول عنوان فعلی: ${title.length} نویسه.`,"عنوان را کوتاه، روشن و منطبق با موضوع صفحه نگه دارید؛ بازه ۱۵ تا ۶۰ فقط راهنمای اولیه است."));
  if (!descriptionContent) findings.push(finding("description-missing","warning","توضیحات متا وجود ندارد","meta description پیدا نشد.","توضیح منحصربه‌فردی بنویسید که محتوای صفحه و ارزش آن را خلاصه کند."));
  else if (descriptionContent.length < 50 || descriptionContent.length > 160) findings.push(finding("description-length","info","طول توضیحات متا را بازبینی کنید",`طول توضیحات: ${descriptionContent.length} نویسه.`,"متن را طبیعی و دقیق تنظیم کنید؛ موتور جست‌وجو ممکن است snippet دیگری نمایش دهد."));
  if (h1.length === 0) findings.push(finding("h1-missing","warning","تیتر اصلی H1 پیدا نشد","هیچ تگ H1 در HTML وجود ندارد.","یک H1 روشن و مرتبط با موضوع اصلی صفحه اضافه کنید."));
  if (h1.length > 1) findings.push(finding("h1-multiple","info","چند H1 در صفحه وجود دارد",`تعداد H1: ${h1.length}.`,"ساختار تیترها را از نظر معنایی بررسی کنید؛ وجود چند H1 لزوماً خطای قطعی نیست."));
  if (!lang) findings.push(finding("html-lang-missing","warning","زبان سند مشخص نشده است","ویژگی lang در تگ html وجود ندارد.","زبان اصلی محتوا را با کد معتبر مانند fa یا en مشخص کنید."));
  if (!viewport) findings.push(finding("viewport-missing","warning","تنظیم viewport پیدا نشد","meta viewport در HTML وجود ندارد.","برای نمایش واکنش‌گرا، meta viewport مناسب اضافه کنید."));
  if (canonical.length === 0) findings.push(finding("canonical-missing","info","Canonical مشخص نشده است","هیچ پیوند canonical پیدا نشد.","در صورت نیاز، URL ترجیحی صفحه را مشخص کنید؛ نبود canonical همیشه مشکل نیست."));
  if (canonical.length > 1) findings.push(finding("canonical-multiple","warning","چند Canonical تعریف شده است",`تعداد پیوندهای canonical: ${canonical.length}.`,"یک canonical معتبر و سازگار با URL ترجیحی نگه دارید."));
  if (canonical.length === 1 && !canonicalHref) findings.push(finding("canonical-empty","warning","Canonical فاقد href است","پیوند canonical پیدا شد اما href خالی است.","href را با URL مطلق و معتبر صفحه تکمیل کنید."));
  if (missingAlt.length) findings.push(finding("images-alt-missing","warning","تصاویر بدون متن جایگزین",`${missingAlt.length} تصویر از ${images.length} تصویر، alt خالی یا فاقد alt دارند.`,"برای تصاویر معنادار alt توصیفی بنویسید و برای تصاویر تزئینی alt خالی صریح قرار دهید."));
  if (noHref.length) findings.push(finding("anchors-no-href","info","پیوندهای بدون href",`${noHref.length} تگ لینک فاقد href است.`,"برای عناصر تعاملی از button استفاده کنید یا href معتبر تعریف کنید."));
  if (/\bnoindex\b/.test(robotsContent)) findings.push(finding("robots-noindex","critical","دستور noindex در صفحه دیده شد",`محتوای meta robots: ${robotsContent}.`,"اگر صفحه باید در نتایج جست‌وجو باشد، علت noindex را بررسی کنید؛ این دستور ممکن است عمدی باشد."));
  if (!findings.length) findings.push(finding("no-obvious-issues","info","ایراد آشکار در بررسی پایه پیدا نشد","چک‌های HTML پایه بدون هشدار عبور کردند.","این نتیجه به معنی تضمین سئوی خوب یا رتبه بهتر نیست؛ crawl، داده سرچ و عملکرد واقعی جداگانه بررسی شوند."));
  const counts = {critical:0,warning:0,info:0};
  for (const item of findings) counts[item.severity] += 1;
  return { findings, counts, metrics: { titleLength:title.length, descriptionLength:descriptionContent.length, h1Count:h1.length, imageCount:images.length, imagesMissingAlt:missingAlt.length, linkCount:anchors.length, headings }, limitations: ["این ابزار فقط HTML واردشده را بررسی می‌کند و هیچ URLای را واکشی نمی‌کند.","داده رتبه، ترافیک، حجم جست‌وجو، Core Web Vitals، وضعیت واقعی ایندکس و محتوای رندرشده را اندازه‌گیری نمی‌کند.","این بررسی اولیه جایگزین ممیزی کامل فنی یا داده Google Search Console نیست."] };
}

export const SEO_AUDIT_MAX_HTML_LENGTH = MAX_HTML_LENGTH;
