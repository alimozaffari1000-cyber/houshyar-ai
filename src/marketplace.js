const COPY = {
  fa: { open:"بازارگاه", title:"بازارگاه هوش‌یار", subtitle:"محصولات فروشگاه‌های تأییدشده را ببین یا فروشگاه خودت را راه‌اندازی کن.", close:"بستن", browse:"فروشگاه‌ها", seller:"پنل فروشنده", search:"جست‌وجوی محصول یا فروشگاه…", find:"جست‌وجو", loading:"در حال دریافت اطلاعات…", empty:"هنوز محصولی برای نمایش وجود ندارد.", more:"محصولات بیشتر", login:"برای ورود به پنل فروشنده ابتدا وارد حساب شو.", account:"ورود به حساب", applyTitle:"درخواست ایجاد فروشگاه", storeName:"نام فروشگاه", slug:"نشانی کوتاه انگلیسی (مثلاً aria-shop)", description:"معرفی فروشگاه", apply:"ارسال درخواست", pending:"درخواست فروشگاهت برای بررسی مدیر ارسال شده است.", suspended:"این فروشگاه موقتاً غیرفعال است.", active:"فروشگاه تأیید شده است.", productTitle:"نام محصول", category:"دسته‌بندی انگلیسی (مثلاً fashion)", price:"قیمت به ریال", stock:"موجودی", productDescription:"توضیحات محصول", createProduct:"ثبت محصول", products:"محصولات من", draft:"پیش‌نویس", published:"منتشرشده", publish:"انتشار محصول", noProducts:"هنوز محصولی ثبت نکرده‌ای.", submitted:"درخواست ثبت شد.", created:"محصول به‌صورت پیش‌نویس ثبت شد.", publishedDone:"محصول منتشر شد.", requestFailed:"درخواست انجام نشد. دوباره تلاش کن.", catalogUnavailable:"دریافت فروشگاه‌ها موقتاً ممکن نیست.", currency:"ریال", store:"فروشگاه", noStore:"هنوز فروشگاهی ثبت نکرده‌ای.", priceInvalid:"قیمت باید عدد صحیح و بیشتر از صفر باشد.", stockInvalid:"موجودی باید عدد صحیح و صفر یا بیشتر باشد.", notReady:"پایگاه داده فروشگاه هنوز در محیط انتشار راه‌اندازی نشده است.", note:"تصاویر محصولات در فضای خصوصی ذخیره می‌شوند؛ پرو مجازی هوش مصنوعی هنوز فعال نیست.", localTitle:"پیدا کردن فروشگاه نزدیک", localHint:"نام کالا را بنویس؛ با شهر یا موقعیت مکانی، فروشگاه‌های دارای آن کالا را پیدا کن.", localQuery:"مثلاً سیب، نان یا مبل", localCity:"شهر یا منطقه", localMode:"روش دریافت", localAny:"همه روش‌ها", localDelivery:"ارسال به منزل", localPickup:"تحویل حضوری", localSearch:"جست‌وجوی نزدیک", localLocation:"استفاده از موقعیت من", localNeedArea:"برای جست‌وجوی نزدیک، شهر را وارد کن یا خودت دکمه موقعیت مکانی را بزن.", localNoResults:"فروشگاهی با این شرایط پیدا نشد.", localDistance:"فاصله تقریبی", localDeliveryYes:"ارسال به منزل دارد", localPickupYes:"تحویل حضوری دارد", localOrder:"سفارش در سایت فروشگاه", localCall:"تماس با فروشگاه", localStock:"موجودی اعلام‌شده توسط فروشنده؛ پیش از خرید تأیید کن.", localLocationDenied:"موقعیت دریافت نشد؛ اجازه مکان‌یابی را بررسی کن یا شهر را دستی وارد کن.", localLocationUnsupported:"این مرورگر مکان‌یابی را پشتیبانی نمی‌کند؛ شهر را دستی وارد کن.", storeProfileTitle:"اطلاعات و موقعیت فروشگاه", storeCity:"شهر", storeRegion:"استان / منطقه", storeAddress:"نشانی عمومی فروشگاه", storePhone:"شماره تماس فروشگاه", storeOrderUrl:"لینک سفارش آنلاین (HTTPS)", storeLatitude:"عرض جغرافیایی", storeLongitude:"طول جغرافیایی", storeDelivery:"ارسال به منزل دارم", storePickup:"تحویل حضوری دارم", storeLocation:"ثبت موقعیت فعلی فروشگاه", storeSave:"ذخیره اطلاعات فروشگاه", storeSaved:"اطلاعات فروشگاه ذخیره شد.", storeLocationDenied:"موقعیت دریافت نشد؛ مجوز مکان را بررسی کن.", storeLocationUnsupported:"این مرورگر مکان‌یابی را پشتیبانی نمی‌کند.", mediaUpload:"افزودن تصویر", mediaDelete:"حذف تصویر", mediaGallery:"گالری تصاویر محصول", mediaUploaded:"تصویر محصول در فضای خصوصی فروشگاه ذخیره شد.", mediaNotReady:"فضای ذخیره‌سازی تصاویر هنوز به Cloudflare متصل نشده است.", mediaInvalid:"تصویر باید JPG، PNG یا WebP و حداکثر ۵ مگابایت باشد.", galleryOpen:"مشاهده تصاویر", galleryLoading:"در حال بارگذاری تصاویر…", galleryEmpty:"برای این محصول تصویری ثبت نشده است.", stockAvailable:"موجود", stockUnavailable:"ناموجود", stockCount:"موجودی" },
  en: { open:"Marketplace", title:"Houshyar Marketplace", subtitle:"Browse approved shops or apply to open your own store.", close:"Close", browse:"Browse products", seller:"Seller dashboard", search:"Search products or shops…", find:"Search", loading:"Loading…", empty:"No products are available yet.", more:"Load more", login:"Sign in to access the seller dashboard.", account:"Open account", applyTitle:"Apply for a store", storeName:"Store name", slug:"Short URL slug (e.g. aria-shop)", description:"Store description", apply:"Submit application", pending:"Your store application is awaiting administrator review.", suspended:"This store is temporarily suspended.", active:"Your store is approved.", productTitle:"Product name", category:"Category slug (e.g. fashion)", price:"Price in IRR", stock:"Stock quantity", productDescription:"Product description", createProduct:"Save product", products:"My products", draft:"Draft", published:"Published", publish:"Publish product", noProducts:"You have not added products yet.", submitted:"Application submitted.", created:"Product saved as a draft.", publishedDone:"Product published.", requestFailed:"Request failed. Please try again.", catalogUnavailable:"The catalog is temporarily unavailable.", currency:"IRR", store:"Store", noStore:"You do not have a store yet.", priceInvalid:"Price must be a positive whole number.", stockInvalid:"Stock must be a non-negative whole number.", notReady:"The marketplace database is not configured in this deployment yet.", note:"Product images are stored privately; AI virtual try-on is not active yet.", localTitle:"Find nearby stores", localHint:"Enter a product and search by city or your location.", localQuery:"e.g. apples, bread or sofa", localCity:"City or area", localMode:"Fulfillment", localAny:"Any option", localDelivery:"Home delivery", localPickup:"Store pickup", localSearch:"Search nearby", localLocation:"Use my location", localNeedArea:"Enter a city or choose Use my location to search nearby stores.", localNoResults:"No stores matched these filters.", localDistance:"Approx. distance", localDeliveryYes:"Home delivery", localPickupYes:"Store pickup", localOrder:"Order on store website", localCall:"Call store", localStock:"Stock reported by the seller; confirm before purchase.", localLocationDenied:"Location unavailable. Check permission or enter a city manually.", localLocationUnsupported:"Geolocation is unavailable in this browser; enter a city manually.", storeProfileTitle:"Store details and location", storeCity:"City", storeRegion:"State / region", storeAddress:"Public store address", storePhone:"Store phone", storeOrderUrl:"Online ordering URL (HTTPS)", storeLatitude:"Latitude", storeLongitude:"Longitude", storeDelivery:"I offer home delivery", storePickup:"I offer in-store pickup", storeLocation:"Use current store location", storeSave:"Save store details", storeSaved:"Store details saved.", storeLocationDenied:"Location unavailable. Check browser permission.", storeLocationUnsupported:"Geolocation is unavailable in this browser.", mediaUpload:"Add image", mediaDelete:"Delete image", mediaGallery:"Product image gallery", mediaUploaded:"Product image saved to private store storage.", mediaNotReady:"Product image storage is not connected to Cloudflare yet.", mediaInvalid:"Use a JPG, PNG or WebP image up to 5 MB.", galleryOpen:"View images", galleryLoading:"Loading images…", galleryEmpty:"No images have been added for this product.", stockAvailable:"In stock", stockUnavailable:"Out of stock", stockCount:"Stock" }
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
    '<section data-market-view="browse"><form class="marketplace-search"><input name="q" maxlength="80" placeholder="' + c.search + '" aria-label="' + c.search + '"><button type="submit">' + c.find + '</button></form><div class="marketplace-products" aria-live="polite"></div><button type="button" class="marketplace-more" hidden>' + c.more + '</button>' +
    '<section class="marketplace-local"><h3>' + c.localTitle + '</h3><p>' + c.localHint + '</p>' +
    '<form class="marketplace-local-search"><input name="q" maxlength="80" placeholder="' + c.localQuery + '" aria-label="' + c.localQuery + '">' +
    '<input name="city" maxlength="80" placeholder="' + c.localCity + '" aria-label="' + c.localCity + '">' +
    '<select name="mode" aria-label="' + c.localMode + '"><option value="">' + c.localAny + '</option><option value="delivery">' + c.localDelivery + '</option><option value="pickup">' + c.localPickup + '</option></select>' +
    '<button type="submit">' + c.localSearch + '</button><button type="button" class="marketplace-location-button">' + c.localLocation + '</button></form>' +
    '<p class="marketplace-local-status" role="status" aria-live="polite"></p><div class="marketplace-local-results" aria-live="polite"></div></section></section>' +
    '<section data-market-view="seller" hidden><div class="marketplace-seller-content"></div></section><p class="marketplace-note">' + c.note + '</p></div>';
  app.append(overlay);
  const status = overlay.querySelector(".marketplace-status");
  const productsNode = overlay.querySelector(".marketplace-products");
  const sellerNode = overlay.querySelector(".marketplace-seller-content");
  const localResultsNode = overlay.querySelector(".marketplace-local-results");
  const localStatusNode = overlay.querySelector(".marketplace-local-status");
  const localForm = overlay.querySelector(".marketplace-local-search");
  const locationButton = overlay.querySelector(".marketplace-location-button");
  const localSay = message => { localStatusNode.textContent = message || ""; };
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
  const productCard = product => '<article class="marketplace-product" data-product-card="' + escape(product.id) + '">' + (product.primaryMediaId ? '<img class="marketplace-product-image" src="/api/product-media/' + encodeURIComponent(product.primaryMediaId) + '" alt="' + escape(product.title) + '" loading="lazy" decoding="async">' : '<div class="marketplace-product-art" aria-hidden="true">✧</div>') + '<div class="marketplace-product-info">' +
    '<span class="marketplace-category">' + escape(product.category) + '</span><h3>' + escape(product.title) + '</h3><p>' + escape(product.description || "") + '</p><strong>' +
    money(product.priceMinor, locale) + ' ' + escape(product.currency || c.currency) + '</strong><small>' + c.store + ': ' + escape(product.storeName || "") + '</small><small class="marketplace-stock-state">' + c.stockCount + ' : ' + (Number(product.stockCount) > 0 ? c.stockAvailable : c.stockUnavailable) + '</small>' + (product.primaryMediaId ? '<button type="button" class="marketplace-gallery-open" data-product-gallery="' + escape(product.id) + '">' + c.galleryOpen + '</button>' : '') + '</div><div class="marketplace-product-gallery" data-product-gallery-items="' + escape(product.id) + '" hidden></div></article>';
  function renderLocalResults(products) {
    if (!products.length) { localResultsNode.innerHTML = '<p class="marketplace-local-empty">' + c.localNoResults + '</p>'; return; }
    localResultsNode.innerHTML = products.map(product => {
      const distance = product.distanceKm !== null && Number.isFinite(Number(product.distanceKm))
        ? '<small>' + c.localDistance + ': ' + escape(product.distanceKm) + ' km</small>' : '';
      const fulfillment = (product.offersDelivery ? '<span>' + c.localDeliveryYes + '</span>' : '') +
        (product.offersPickup ? '<span>' + c.localPickupYes + '</span>' : '');
      const orderUrl = /^https:\/\//i.test(String(product.orderUrl || "")) ? String(product.orderUrl) : "";
      const phone = String(product.contactPhone || "").replace(/[^+0-9(). -]/g, "");
      return '<article class="marketplace-local-card">' + (product.primaryMediaId ? '<img class="marketplace-local-image" src="/api/product-media/' + encodeURIComponent(product.primaryMediaId) + '" alt="' + escape(product.title) + '" loading="lazy" decoding="async">' : '') + '<div><span class="marketplace-category">' + escape(product.category || c.store) +
        '</span><h4>' + escape(product.title) + '</h4><p>' + escape(product.description || "") + '</p>' +
        '<strong>' + money(product.priceMinor, locale) + ' ' + escape(product.currency || c.currency) + '</strong>' +
        '<small>' + escape(product.storeName || "") + (product.city ? ' · ' + escape(product.city) : '') + '</small>' +
        (product.publicAddress ? '<small>' + escape(product.publicAddress) + '</small>' : '') + distance +
        '<div class="marketplace-local-tags">' + fulfillment + '</div><small>' + c.localStock + '</small></div>' +
        '<div class="marketplace-local-actions">' + (orderUrl ? '<a href="' + escape(orderUrl) + '" target="_blank" rel="noopener noreferrer">' + c.localOrder + '</a>' : '') +
        (phone ? '<a href="tel:' + escape(phone) + '">' + c.localCall + '</a>' : '') + '</div></article>';
    }).join("");
  }
  async function searchLocalStores({ latitude, longitude } = {}) {
    const query = localForm.elements.q.value.trim();
    const city = localForm.elements.city.value.trim();
    const mode = localForm.elements.mode.value;
    if (!city && (latitude === undefined || longitude === undefined)) {
      localSay(c.localNeedArea); return;
    }
    const params = new URLSearchParams({ limit:"50" });
    if (query) params.set("q", query);
    if (city) params.set("city", city);
    if (mode) params.set("mode", mode);
    if (latitude !== undefined && longitude !== undefined) {
      params.set("lat", String(latitude)); params.set("lon", String(longitude));
    }
    localSay(c.loading); localResultsNode.innerHTML = "";
    try {
      const data = await request("/api/stores?" + params.toString());
      renderLocalResults(Array.isArray(data.products) ? data.products : []);
      localSay("");
    } catch { localSay(c.catalogUnavailable); }
  }
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
  function renderSeller(data, mediaItems = []) {
    const store = data.store;
    if (!store) { renderApplication(); return; }
    const stateText = store.status === "active" ? c.active : store.status === "suspended" ? c.suspended : c.pending;
    const mediaByProduct = new Map(); mediaItems.forEach(item => { const list = mediaByProduct.get(item.productId) || []; list.push(item); mediaByProduct.set(item.productId, list); });
    const rows = (data.products || []).map(product => { const gallery = mediaByProduct.get(product.id) || []; return '<article class="marketplace-seller-product">' + (product.primaryMediaId ? '<img class="marketplace-seller-thumb" src="/api/product-media/' + encodeURIComponent(product.primaryMediaId) + '" alt="' + escape(product.title) + '" loading="lazy" decoding="async">' : '<span class="marketplace-seller-thumb marketplace-seller-thumb-empty" aria-hidden="true">✧</span>') + '<div><b>' + escape(product.title) + '</b><small>' +
      escape(product.category) + ' · ' + money(product.priceMinor, locale) + ' ' + escape(product.currency) + '</small></div><span class="marketplace-state">' +
      (product.status === "published" ? c.published : c.draft) + '</span>' +
      (product.status === "draft" && store.status === "active" ? '<button type="button" data-publish="' + escape(product.id) + '">' + c.publish + '</button>' : '') +
      (gallery.length ? '<div class="marketplace-media-gallery"><b>' + c.mediaGallery + '</b>' + gallery.map(item => '<div class="marketplace-media-item"><img src="/api/product-media/' + encodeURIComponent(item.id) + '" alt="" loading="lazy" decoding="async">' + (store.status === "active" ? '<button type="button" data-delete-media="' + escape(item.id) + '">' + c.mediaDelete + '</button>' : '') + '</div>').join("") + '</div>' : '') + (store.status === "active" ? '<label class="marketplace-media-upload">' + c.mediaUpload + '<input type="file" accept="image/jpeg,image/png,image/webp" data-product-media-upload="' + escape(product.id) + '" multiple></label>' : '') + '</article>'; }).join("");
    sellerNode.innerHTML = '<div class="marketplace-store-state"><b>' + escape(store.name) + '</b><span>' + escape(stateText) + '</span></div>' +
      (store.status === "active" ? '<div class="marketplace-form-card"><h3>' + c.storeProfileTitle + '</h3><form data-store-profile>' +
      '<label>' + c.storeCity + '<input name="city" minlength="2" maxlength="80" required value="' + escape(store.city || "") + '"></label>' +
      '<label>' + c.storeRegion + '<input name="region" maxlength="80" value="' + escape(store.region || "") + '"></label>' +
      '<label>' + c.storeAddress + '<input name="publicAddress" maxlength="240" value="' + escape(store.publicAddress || "") + '"></label>' +
      '<label>' + c.storePhone + '<input name="contactPhone" maxlength="30" type="tel" value="' + escape(store.contactPhone || "") + '"></label>' +
      '<label>' + c.storeOrderUrl + '<input name="orderUrl" maxlength="500" type="url" placeholder="https://…" dir="ltr" value="' + escape(store.orderUrl || "") + '"></label>' +
      '<label>' + c.storeLatitude + '<input name="latitude" type="number" min="-90" max="90" step="any" value="' + escape(store.latitude ?? "") + '"></label>' +
      '<label>' + c.storeLongitude + '<input name="longitude" type="number" min="-180" max="180" step="any" value="' + escape(store.longitude ?? "") + '"></label>' +
      '<label class="marketplace-check-label"><input name="offersDelivery" type="checkbox" ' + (store.offersDelivery ? 'checked' : '') + '> ' + c.storeDelivery + '</label>' +
      '<label class="marketplace-check-label"><input name="offersPickup" type="checkbox" ' + (store.offersPickup ? 'checked' : '') + '> ' + c.storePickup + '</label>' +
      '<button type="button" data-store-location>' + c.storeLocation + '</button><button type="submit">' + c.storeSave + '</button></form></div>' : '') +
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
    try { const [data, mediaData] = await Promise.all([request("/api/store/mine"), request("/api/store/products/media")]); renderSeller(data, Array.isArray(mediaData.media) ? mediaData.media : []); say(""); }
    catch (error) {
      if (error.status === 401) sellerNode.innerHTML = '<div class="marketplace-form-card"><p>' + c.login + '</p><button type="button" data-market-account>' + c.account + '</button></div>';
      else say(error.status === 503 ? c.notReady : c.requestFailed);
    }
  }
  trigger.addEventListener("click", () => { overlay.hidden = false; document.body.classList.add("marketplace-open"); showTab("browse"); loadCatalog(true); });
  overlay.querySelector("[data-market-close]").addEventListener("click", () => { overlay.hidden = true; document.body.classList.remove("marketplace-open"); });
  overlay.addEventListener("click", async event => {
    const galleryButton = event.target.closest("[data-product-gallery]");
    if (galleryButton) {
      const productId = galleryButton.dataset.productGallery;
      const gallery = Array.from(overlay.querySelectorAll("[data-product-gallery-items]")).find(node => node.dataset.productGalleryItems === productId);
      if (gallery && gallery.hidden) {
        gallery.hidden = false; gallery.textContent = c.galleryLoading; galleryButton.disabled = true;
        try {
          const data = await request("/api/products/" + encodeURIComponent(productId) + "/media");
          gallery.innerHTML = (data.media || []).map(item => '<a href="/api/product-media/' + encodeURIComponent(item.id) + '" target="_blank" rel="noopener noreferrer"><img src="/api/product-media/' + encodeURIComponent(item.id) + '" alt="" loading="lazy" decoding="async"></a>').join("") || '<span>' + c.galleryEmpty + '</span>';
        } catch { gallery.textContent = c.requestFailed; }
        finally { galleryButton.disabled = false; }
      } else if (gallery) gallery.hidden = true;
      return;
    }
    if (event.target === overlay) { overlay.hidden = true; document.body.classList.remove("marketplace-open"); }
    const account = event.target.closest("[data-market-account]");
    if (account) { overlay.hidden = true; document.body.classList.remove("marketplace-open"); app.querySelector("#account-open")?.click(); }
    const removeMedia = event.target.closest("[data-delete-media]");
    if (removeMedia) deleteProductMedia(removeMedia);
    const publish = event.target.closest("[data-publish]");
    if (publish) publishProduct(publish);
    const storeLocation = event.target.closest("[data-store-location]");
    if (storeLocation) {
      const form = storeLocation.closest("[data-store-profile]");
      if (!navigator.geolocation) { say(c.storeLocationUnsupported); return; }
      storeLocation.disabled = true; say(c.loading);
      navigator.geolocation.getCurrentPosition(position => {
        form.elements.latitude.value = String(position.coords.latitude);
        form.elements.longitude.value = String(position.coords.longitude);
        storeLocation.disabled = false; say("");
      }, () => { storeLocation.disabled = false; say(c.storeLocationDenied); },
      { enableHighAccuracy:false, maximumAge:300000, timeout:10000 });
    }
  });
  async function uploadProductMedia(input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    if (files.some(file => !["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      say(c.mediaInvalid); input.value = ""; return;
    }
    const body = new FormData();
    body.set("productId", input.dataset.productMediaUpload);
    input.disabled = true; say(c.loading);
    try {
      for (const file of files) { const body = new FormData(); body.set("productId", input.dataset.productMediaUpload); body.set("file", file); await request("/api/store/products/media", { method:"POST", body }); }
      input.value = "";
      await loadSeller();
      say(c.mediaUploaded);
    } catch (error) {
      say(error.status === 503 ? c.mediaNotReady : error.status === 400 ? c.mediaInvalid : c.requestFailed);
    } finally { input.disabled = false; }
  }
  async function deleteProductMedia(button) {
    if (!button || button.disabled) return;
    button.disabled = true; say(c.loading);
    try {
      await request("/api/store/products/media", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ mediaId:button.dataset.deleteMedia }) });
      await loadSeller(); say(c.mediaUploaded);
    } catch { say(c.requestFailed); button.disabled = false; }
  }
  async function publishProduct(button) {
    button.disabled = true; say(c.loading);
    try { await request("/api/store/products/publish", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ productId:button.dataset.publish }) }); say(c.publishedDone); await loadSeller(); }
    catch { say(c.requestFailed); button.disabled = false; }
  }
  overlay.querySelectorAll("[data-market-tab]").forEach(button => button.addEventListener("click", () => showTab(button.dataset.marketTab)));
  overlay.querySelector(".marketplace-search").addEventListener("submit", event => { event.preventDefault(); query = event.currentTarget.elements.q.value.trim(); loadCatalog(true); });
  more.addEventListener("click", () => loadCatalog(false));
  localForm.addEventListener("submit", event => { event.preventDefault(); searchLocalStores(); });
  locationButton.addEventListener("click", () => {
    if (!navigator.geolocation) { localSay(c.localLocationUnsupported); return; }
    locationButton.disabled = true; localSay(c.loading);
    navigator.geolocation.getCurrentPosition(position => {
      locationButton.disabled = false;
      searchLocalStores({ latitude:position.coords.latitude, longitude:position.coords.longitude });
    }, () => {
      locationButton.disabled = false; localSay(c.localLocationDenied);
    }, { enableHighAccuracy:false, maximumAge:300000, timeout:10000 });
  });
  overlay.addEventListener("change", event => { const input = event.target.closest("[data-product-media-upload]"); if (input) uploadProductMedia(input); });
  overlay.addEventListener("submit", async event => {
    const form = event.target;
    if (form.matches("[data-store-apply]")) {
      event.preventDefault(); const button = form.querySelector("button[type=submit]"); button.disabled = true; say(c.loading);
      try { await request("/api/store/apply", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name:form.elements.name.value, slug:form.elements.slug.value, description:form.elements.description.value }) }); say(c.submitted); await loadSeller(); }
      catch { say(c.requestFailed); button.disabled = false; }
    }
    if (form.matches("[data-store-profile]")) {
      event.preventDefault();
      const latitude = form.elements.latitude.value.trim();
      const longitude = form.elements.longitude.value.trim();
      if ((latitude === "") !== (longitude === "")) { say(c.requestFailed); return; }
      const button = form.querySelector('button[type="submit"]'); button.disabled = true; say(c.loading);
      try {
        await request("/api/store/profile", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
          city:form.elements.city.value, region:form.elements.region.value, publicAddress:form.elements.publicAddress.value,
          contactPhone:form.elements.contactPhone.value, orderUrl:form.elements.orderUrl.value,
          latitude:latitude === "" ? null : Number(latitude), longitude:longitude === "" ? null : Number(longitude),
          offersDelivery:form.elements.offersDelivery.checked, offersPickup:form.elements.offersPickup.checked
        }) });
        say(c.storeSaved); await loadSeller();
      } catch { say(c.requestFailed); button.disabled = false; }
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
