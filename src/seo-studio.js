const COPY = {
  fa: {
    open:"استودیوی سئو", title:"استودیوی سئو هوش‌یار",
    desc:"اطلاعات سایت و بازار هدفت را وارد کن تا هوش‌یار یک برنامه ممیزی و بهبود سئو تهیه کند.",
    close:"بستن", website:"نشانی سایت", business:"نوع کسب‌وکار", market:"کشور یا بازار هدف",
    keywords:"کلمات کلیدی هدف", competitors:"رقبای اصلی (اختیاری)",
    language:"زبان محتوا", submit:"شروع تحلیل با هوش‌یار",
    note:"این ابزار اطلاعات واردشده را برای تحلیل به چت هوش‌یار می‌فرستد؛ در این نسخه سایت را خودکار نمی‌خزد و رتبه گوگل یا داده‌های سرچ کنسول را مستقیماً نمی‌خواند.",
    urlError:"نشانی سایت باید با http:// یا https:// شروع شود.",
    placeholderBusiness:"مثلاً فروشگاه پوشاک آنلاین",
    placeholderMarket:"مثلاً ایران",
    placeholderKeywords:"مثلاً خرید لباس، مانتو زنانه، پوشاک ارزان",
    placeholderCompetitors:"نشانی یا نام رقبا",
    languageOptions:["فارسی","انگلیسی","عربی","ترکی","آلمانی","سایر"],
    promptIntro:"به‌عنوان مشاور ارشد سئو و رشد ارگانیک، یک ممیزی عملی و اولویت‌بندی‌شده برای کسب‌وکار زیر تهیه کن.",
    promptRules:"خروجی را فارسی و با این بخش‌ها ارائه کن: ۱) خلاصه وضعیت و فرضیات ۲) بررسی نیت جست‌وجو و کلمات کلیدی ۳) پیشنهاد ساختار صفحات و معماری اطلاعات ۴) پیشنهاد عنوان و متادیسکریپشن برای صفحات مهم ۵) چک‌لیست سئوی فنی که باید دستی بررسی شود (خزش، ایندکس، canonical، sitemap، robots، سرعت، موبایل، داده ساختاریافته) ۶) برنامه محتوایی ۳۰ روزه ۷) اولویت‌بندی اقدامات بر اساس اثر/هزینه ۸) معیارهای سنجش. برای مواردی که داده واقعی در اختیار نداری صریحاً «نیازمند بررسی» بنویس؛ هرگز عدد، رتبه یا خطای سایت را حدس نزن. اگر جست‌وجوی وب در این گفتگو فعال است، رقبا و نتایج را با منبع بررسی کن؛ در غیر این صورت فرضیه‌ها را از واقعیت تفکیک کن.",
    invalid:"لطفاً نشانی معتبر سایت را وارد کن."
  },
  en: {
    open:"SEO Studio", title:"Houshyar SEO Studio",
    desc:"Enter your website and target market to generate a practical SEO audit brief.",
    close:"Close", website:"Website URL", business:"Business type", market:"Target country or market",
    keywords:"Target keywords", competitors:"Main competitors (optional)",
    language:"Content language", submit:"Start analysis with Houshyar",
    note:"This sends your inputs to Houshyar chat for analysis. This version does not crawl the site or directly access Google rankings or Search Console data.",
    urlError:"The website URL must start with http:// or https://.",
    placeholderBusiness:"e.g. online fashion store", placeholderMarket:"e.g. Iran",
    placeholderKeywords:"e.g. buy clothes, women's fashion", placeholderCompetitors:"Competitor names or URLs",
    languageOptions:["Persian","English","Arabic","Turkish","German","Other"],
    promptIntro:"Act as a senior SEO and organic growth consultant. Prepare a practical, prioritized audit for this business.",
    promptRules:"Respond in English with: 1) status summary and assumptions 2) search intent and keyword opportunities 3) page architecture 4) suggested title tags and meta descriptions 5) technical SEO checklist requiring manual verification (crawlability, indexation, canonical, sitemap, robots, speed, mobile, structured data) 6) 30-day content plan 7) impact/effort prioritization 8) measurement KPIs. Explicitly mark unavailable evidence as 'requires verification'; never invent site errors, rankings, or metrics. If web search is enabled in this chat, research competitors and cite sources; otherwise distinguish hypotheses from verified facts.",
    invalid:"Enter a valid website URL."
  }
};

const copyFor = locale => COPY[locale] || COPY.en;
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[char]));

export function buildSeoAuditPrompt(input, locale = "fa") {
  const c = copyFor(locale);
  const fields = [
    ["Website", input.website],
    ["Business", input.business],
    ["Target market", input.market],
    ["Target keywords", input.keywords],
    ["Competitors", input.competitors || "Not provided"],
    ["Content language", input.contentLanguage]
  ];
  return c.promptIntro + "\n\n" + fields.map(([label, value]) => label + ": " + String(value || "Not provided").trim()).join("\n") + "\n\n" + c.promptRules;
}

export function initSeoStudio(app, { locale = "fa", onUsePrompt } = {}) {
  const trigger = app.querySelector("[data-open-seo-studio]");
  if (!trigger || app.querySelector("#seo-studio-overlay")) return;
  const c = copyFor(locale);
  const overlay = document.createElement("section");
  overlay.id = "seo-studio-overlay";
  overlay.className = "seo-studio-overlay";
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="seo-studio-dialog" role="dialog" aria-modal="true" aria-labelledby="seo-studio-title">' +
      '<header class="seo-studio-head"><div><h2 id="seo-studio-title">' + c.title + '</h2><p>' + c.desc + '</p></div><button type="button" data-seo-close aria-label="' + c.close + '">×</button></header>' +
      '<form class="seo-studio-form">' +
        '<label>' + c.website + '<input name="website" type="url" inputmode="url" placeholder="https://example.com" required maxlength="240"></label>' +
        '<label>' + c.business + '<input name="business" maxlength="120" placeholder="' + c.placeholderBusiness + '" required></label>' +
        '<label>' + c.market + '<input name="market" maxlength="100" placeholder="' + c.placeholderMarket + '" required></label>' +
        '<label>' + c.keywords + '<textarea name="keywords" rows="3" maxlength="1200" placeholder="' + c.placeholderKeywords + '" required></textarea></label>' +
        '<label>' + c.competitors + '<textarea name="competitors" rows="2" maxlength="800" placeholder="' + c.placeholderCompetitors + '"></textarea></label>' +
        '<label>' + c.language + '<select name="contentLanguage">' + c.languageOptions.map((name, index) => '<option value="' + esc(name) + '"' + (index === 0 ? ' selected' : '') + '>' + esc(name) + '</option>').join('') + '</select></label>' +
        '<p class="seo-studio-error" role="alert"></p><button type="submit">' + c.submit + '</button>' +
      '</form><p class="seo-studio-note">' + c.note + '</p>' +
    '</div>';
  app.append(overlay);
  const form = overlay.querySelector("form");
  const error = overlay.querySelector(".seo-studio-error");
  trigger.addEventListener("click", () => { overlay.hidden = false; error.textContent = ""; });
  overlay.querySelector("[data-seo-close]").addEventListener("click", () => { overlay.hidden = true; });
  overlay.addEventListener("click", event => { if (event.target === overlay) overlay.hidden = true; });
  overlay.addEventListener("keydown", event => { if (event.key === "Escape") overlay.hidden = true; });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    let url;
    try { url = new URL(data.website); } catch { error.textContent = c.invalid; return; }
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
      error.textContent = c.urlError;
      return;
    }
    data.website = url.href;
    if (!data.business.trim() || !data.market.trim() || !data.keywords.trim()) {
      error.textContent = c.invalid;
      return;
    }
    error.textContent = "";
    overlay.hidden = true;
    onUsePrompt?.(buildSeoAuditPrompt(data, locale));
  });
}
