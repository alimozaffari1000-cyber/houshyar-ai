const COPY = {
  fa: { open:"بازارگاه", title:"بازارگاه هوش‌یار", subtitle:"محصولات فروشگاه‌های تأییدشده را ببین یا فروشگاه خودت را راه‌اندازی کن.", close:"بستن", browse:"فروشگاه‌ها", seller:"پنل فروشنده", search:"جست‌وجوی محصول یا فروشگاه…", find:"جست‌وجو", loading:"در حال دریافت اطلاعات…", empty:"هنوز محصولی برای نمایش وجود ندارد.", more:"محصولات بیشتر", login:"برای ورود به پنل فروشنده ابتدا وارد حساب شو.", account:"ورود به حساب", applyTitle:"درخواست ایجاد فروشگاه", storeName:"نام فروشگاه", slug:"نشانی کوتاه انگلیسی (مثلاً aria-shop)", description:"معرفی فروشگاه", apply:"ارسال درخواست", pending:"درخواست فروشگاهت برای بررسی مدیر ارسال شده است.", suspended:"این فروشگاه موقتاً غیرفعال است.", active:"فروشگاه تأیید شده است.", productTitle:"نام محصول", category:"دسته‌بندی انگلیسی (مثلاً fashion)", price:"قیمت به ریال", stock:"موجودی", productDescription:"توضیحات محصول", createProduct:"ثبت محصول", products:"محصولات من", draft:"پیش‌نویس", published:"منتشرشده", publish:"انتشار محصول", noProducts:"هنوز محصولی ثبت نکرده‌ای.", submitted:"درخواست ثبت شد.", created:"محصول به‌صورت پیش‌نویس ثبت شد.", publishedDone:"محصول منتشر شد.", requestFailed:"درخواست انجام نشد. دوباره تلاش کن.", catalogUnavailable:"دریافت فروشگاه‌ها موقتاً ممکن نیست.", currency:"ریال", store:"فروشگاه", noStore:"هنوز فروشگاهی ثبت نکرده‌ای.", priceInvalid:"قیمت باید عدد صحیح و بیشتر از صفر باشد.", stockInvalid:"موجودی باید عدد صحیح و صفر یا بیشتر باشد.", notReady:"پایگاه داده فروشگاه هنوز در محیط انتشار راه‌اندازی نشده است.", note:"در این نسخه پرداخت، سبد خرید، ارسال تصویر و پرو مجازی فعال نیستند." },
  en: { open:"Marketplace", title:"Houshyar Marketplace", subtitle:"Browse approved shops or apply to open your own store.", close:"Close", browse:"Browse products", seller:"Seller dashboard", search:"Search products or shops…", find:"Search", loading:"Loading…", empty:"No products are available yet.", more:"Load more", login:"Sign in to access the seller dashboard.", account:"Open account", applyTitle:"Apply for a store", storeName:"Store name", slug:"Short URL slug (e.g. aria-shop)", description:"Store description", apply:"Submit application", pending:"Your store application is awaiting administrator review.", suspended:"This store is temporarily suspended.", active:"Your store is approved.", productTitle:"Product name", category:"Category slug (e.g. fashion)", price:"Price in IRR", stock:"Stock quantity", productDescription:"Product description", createProduct:"Save product", products:"My products", draft:"Draft", published:"Published", publish:"Publish product", noProducts:"You have not added products yet.", submitted:"Application submitted.", created:"Product saved as a draft.", publishedDone:"Product published.", requestFailed:"Request failed. Please try again.", catalogUnavailable:"The catalog is temporarily unavailable.", currency:"IRR", store:"Store", noStore:"You do not have a store yet.", priceInvalid:"Price must be a positive whole number.", stockInvalid:"Stock must be a non-negative whole number.", notReady:"The marketplace database is not configured in this deployment yet.", note:"Checkout, payments, image uploads and virtual try-on are not enabled in this version." }
};
const copyFor = locale => COPY[locale] || COPY.en;
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const money = (value, locale) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale || "en", { maximumFractionDigits:0 }).format(Number(value) || 0);

export function initMarketplace(app, { locale = "fa" } = {}) {
  const trigger = app.querySelector("[data-open-marketplace]");
  if (!trigger || app.querySelector("#marketplace-overlay")) return;
  const c = copyFor(locale);
  const overlay = document.createElement("section");
  overlay.id = "marketplace-overlay";
  overlay.className = "marketplace-overlay";
  overlay.hidden = true;
  overlay.innerHTML = '<div class="marketplace-dialog" role="dialog" aria-modal="true" aria-labelledby="marketplace-title">' +
    '<header class="marketplace-head"><div><h2 id="marketplace-title">' + c.title + '</h2><p>' + c.subtitle + '</p></div><button type="button" data-market-close aria-label="' + c.close + '">×</button></header>' +
    '<nav class="marketplace-tabs" aria-label="' + c.title + '"><button type="button" data-market-tab="browse" class="active">' + c.browse + '</button><button type="button" data-market-tab="seller">' + c.seller + '</button></nav>' +
    '<div class="marketplace-status" role="status" aria-live="polite"></div>' +
    '<section data-market-view="browse"><form class="marketplace-search"><input name="q" maxlength="80" placeholder="' + c.search + '" aria-label="' + c.search + '"><button type="submit">' + c.find + '</button></form><div class="marketplace-products" aria-live="polite"></div><button type="button" class="marketplace-more" hidden>' + c.more + '</button></section>' +
    '<section data-market-view="seller" hidden><div class="marketplace-seller-content"></div></section><p class="marketplace-note">' + c.note + '</p></div>';
  app.append(overlay);
  const status = overlay.querySelector(".marketplace-status");
  const productsNode = overlay.querySelector(".marketplace-products");
  const sellerNode = overlay.querySelector(".marketplace-seller-content");
  const more = overlay.querySelector(".marketplace-more");
  let offset = 0, query = "";
  const say = message => { status.textContent = message || ""; };
  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials:"same-origin", cache:"no-store", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || "REQUEST_FAILED"); error.status = response.status; throw error; }
    return data;
  };
  const showTab = tab => {
    overlay.querySelectorAll("[data-market-tab]").forEach(button => button.classList.toggle("active", button.dataset.marketTab === tab));
    overlay.querySelectorAll("[data-market-view]").forEach(view => { view.hidden = view.dataset.marketView !== tab; });
    say("");
    if (tab === "seller") loadSeller();
  };
  const productCard = product => '<article class="marketplace-product"><div class="marketplace-product-art" aria-hidden="true">✧</div><div class="marketplace-product-info">' +
    '<span class="marketplace-category">' + escape(product.category) + '</span><h3>' + escape(product.title) + '</h3><p>' + escape(product.description || "") + '</p><strong>' +
    money(product.priceMinor, locale) + ' ' + escape(product.currency || c.currency) + '</strong><small>' + c.store + ': ' + escape(product.storeName || "") + '</small></div></article>';
  async function loadCatalog(reset = false) {
    if (reset) { offset = 0; productsNode.innerHTML = ""; }
    say(c.loading); more.hidden = true;
    try {
      const params = new URLSearchParams({ limit:"12", offset:String(offset) });
      if (query) params.set("q", query);
      const data = await request("/api/store/products?" + params.toString());
      productsNode.insertAdjacentHTML("beforeend", (data.products || []).map(productCard).join(""));
      offset += (data.products || []).length;
      more.hidden = data.hasMore !== true;
      say((data.products || []).length || offset ? "" : c.empty);
    } catch (error) { say(error.status === 503 ? c.catalogUnavailable : c.requestFailed); }
  }
  function renderApplication() {
    sellerNode.innerHTML = '<div class="marketplace-form-card"><h3>' + c.applyTitle + '</h3><form data-store-apply>' +
      '<label>' + c.storeName + '<input name="name" minlength="2" maxlength="100" required></label>' +
      '<label>' + c.slug + '<input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="80" required dir="ltr"></label>' +
      '<label>' + c.description + '<textarea name="description" maxlength="1000" rows="3"></textarea></label><button type="submit">' + c.apply + '</button></form></div>';
  }
  function renderSeller(data) {
    const store = data.store;
    if (!store) { renderApplication(); return; }
    const stateText = store.status === "active" ? c.active : store.status === "suspended" ? c.suspended : c.pending;
    const rows = (data.products || []).map(product => '<article class="marketplace-seller-product"><div><b>' + escape(product.title) + '</b><small>' +
      escape(product.category) + ' · ' + money(product.priceMinor, locale) + ' ' + escape(product.currency) + '</small></div><span class="marketplace-state">' +
      (product.status === "published" ? c.published : c.draft) + '</span>' +
      (product.status === "draft" && store.status === "active" ? '<button type="button" data-publish="' + escape(product.id) + '">' + c.publish + '</button>' : '') + '</article>').join("");
    sellerNode.innerHTML = '<div class="marketplace-store-state"><b>' + escape(store.name) + '</b><span>' + escape(stateText) + '</span></div>' +
      (store.status === "active" ? '<div class="marketplace-form-card"><h3>' + c.createProduct + '</h3><form data-product-create>' +
      '<label>' + c.productTitle + '<input name="title" minlength="2" maxlength="160" required></label>' +
      '<label>' + c.category + '<input name="category" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="60" required dir="ltr"></label>' +
      '<label>' + c.price + '<input name="priceMinor" type="number" min="1" step="1" required inputmode="numeric"></label>' +
      '<label>' + c.stock + '<input name="stockCount" type="number" min="0" max="1000000" step="1" value="0" required inputmode="numeric"></label>' +
      '<label>' + c.productDescription + '<textarea name="description" maxlength="5000" rows="3"></textarea></label><button type="submit">' + c.createProduct + '</button></form></div>' : '') +
      '<div class="marketplace-seller-list"><h3>' + c.products + '</h3>' + (rows || '<p>' + c.noProducts + '</p>') + '</div>';
  }
  async function loadSeller() {
    sellerNode.innerHTML = ""; say(c.loading);
    try { const data = await request("/api/store/mine"); renderSeller(data); say(""); }
    catch (error) {
      if (error.status === 401) sellerNode.innerHTML = '<div class="marketplace-form-card"><p>' + c.login + '</p><button type="button" data-market-account>' + c.account + '</button></div>';
      else say(error.status === 503 ? c.notReady : c.requestFailed);
    }
  }
  trigger.addEventListener("click", () => { overlay.hidden = false; document.body.classList.add("marketplace-open"); showTab("browse"); loadCatalog(true); });
  overlay.querySelector("[data-market-close]").addEventListener("click", () => { overlay.hidden = true; document.body.classList.remove("marketplace-open"); });
  overlay.addEventListener("click", event => {
    if (event.target === overlay) { overlay.hidden = true; document.body.classList.remove("marketplace-open"); }
    const account = event.target.closest("[data-market-account]");
    if (account) { overlay.hidden = true; document.body.classList.remove("marketplace-open"); app.querySelector("#account-open")?.click(); }
    const publish = event.target.closest("[data-publish]");
    if (publish) publishProduct(publish);
  });
  async function publishProduct(button) {
    button.disabled = true; say(c.loading);
    try { await request("/api/store/products/publish", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ productId:button.dataset.publish }) }); say(c.publishedDone); await loadSeller(); }
    catch { say(c.requestFailed); button.disabled = false; }
  }
  overlay.querySelectorAll("[data-market-tab]").forEach(button => button.addEventListener("click", () => showTab(button.dataset.marketTab)));
  overlay.querySelector(".marketplace-search").addEventListener("submit", event => { event.preventDefault(); query = event.currentTarget.elements.q.value.trim(); loadCatalog(true); });
  more.addEventListener("click", () => loadCatalog(false));
  overlay.addEventListener("submit", async event => {
    const form = event.target;
    if (form.matches("[data-store-apply]")) {
      event.preventDefault(); const button = form.querySelector("button[type=submit]"); button.disabled = true; say(c.loading);
      try { await request("/api/store/apply", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name:form.elements.name.value, slug:form.elements.slug.value, description:form.elements.description.value }) }); say(c.submitted); await loadSeller(); }
      catch { say(c.requestFailed); button.disabled = false; }
    }
    if (form.matches("[data-product-create]")) {
      event.preventDefault(); const price = Number(form.elements.priceMinor.value), stock = Number(form.elements.stockCount.value);
      if (!Number.isSafeInteger(price) || price <= 0) { say(c.priceInvalid); return; }
      if (!Number.isSafeInteger(stock) || stock < 0) { say(c.stockInvalid); return; }
      const button = form.querySelector("button[type=submit]"); button.disabled = true; say(c.loading);
      try {
        await request("/api/store/products", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ title:form.elements.title.value, category:form.elements.category.value, priceMinor:price, currency:"IRR", stockCount:stock, description:form.elements.description.value }) });
        say(c.created); await loadSeller();
      } catch { say(c.requestFailed); button.disabled = false; }
    }
  });
  overlay.addEventListener("keydown", event => { if (event.key === "Escape" && !overlay.hidden) { overlay.hidden = true; document.body.classList.remove("marketplace-open"); } });
}
