const COPY = {
  fa: { open:"بازارگاه", title:"بازارگاه هوش‌یار", subtitle:"محصولات فروشگاه‌های تأییدشده را ببین یا فروشگاه خودت را راه‌اندازی کن.", close:"بستن", browse:"فروشگاه‌ها", seller:"پنل فروشنده", search:"جست‌وجوی محصول یا فروشگاه…", find:"جست‌وجو", city:"شهر (اختیاری)", allModes:"همه روش‌های دریافت", delivery:"ارسال به منزل", pickup:"دریافت حضوری", near:"نزدیک من", locating:"در حال دریافت موقعیت…", locationDenied:"دسترسی به موقعیت داده نشد؛ می‌توانی نام شهر را وارد کنی.", distance:"فاصله", stockAvailable:"موجود است", outOfStock:"ناموجود", order:"سفارش", deliveryAvailable:"ارسال دارد", pickupAvailable:"تحویل حضوری دارد", limited:"نتایج محدودند؛ برای دقیق‌تر شدن جست‌وجو شهر یا عبارت را مشخص کن.", loading:"در حال دریافت اطلاعات…", empty:"هنوز محصولی برای نمایش وجود ندارد.", foundItems:"کالاهای پیدا‌شده", missingItems:"کالاهای پیدا‌نشده", coveredStores:"فروشگاه‌های دارای بیشترین اقلام درخواستی", more:"محصولات بیشتر", login:"برای ورود به پنل فروشنده ابتدا وارد حساب شو.", account:"ورود به حساب", applyTitle:"درخواست ایجاد فروشگاه", storeName:"نام فروشگاه", slug:"نشانی کوتاه انگلیسی (مثلاً aria-shop)", description:"معرفی فروشگاه", apply:"ارسال درخواست", pending:"درخواست فروشگاهت برای بررسی مدیر ارسال شده است.", suspended:"این فروشگاه موقتاً غیرفعال است.", active:"فروشگاه تأیید شده است.", productTitle:"نام محصول", category:"دسته‌بندی انگلیسی (مثلاً fashion)", price:"قیمت به ریال", stock:"موجودی", productDescription:"توضیحات محصول", createProduct:"ثبت محصول", products:"محصولات من", draft:"پیش‌نویس", published:"منتشرشده", publish:"انتشار محصول", noProducts:"هنوز محصولی ثبت نکرده‌ای.", submitted:"درخواست ثبت شد.", created:"محصول به‌صورت پیش‌نویس ثبت شد.", publishedDone:"محصول منتشر شد.", requestFailed:"درخواست انجام نشد. دوباره تلاش کن.", catalogUnavailable:"دریافت فروشگاه‌ها موقتاً ممکن نیست.", currency:"ریال", store:"فروشگاه", noStore:"هنوز فروشگاهی ثبت نکرده‌ای.", priceInvalid:"قیمت باید عدد صحیح و بیشتر از صفر باشد.", stockInvalid:"موجودی باید عدد صحیح و صفر یا بیشتر باشد.", notReady:"پایگاه داده فروشگاه هنوز در محیط انتشار راه‌اندازی نشده است.", note:"ثبت سفارش در این مرحله درخواست به فروشنده است؛ پرداخت آنلاین و ارسال تصویر هنوز فعال نیست.", orders:"سفارش‌ها", orderRequest:"درخواست سفارش", quantity:"تعداد", pendingOrder:"در انتظار تأیید", acceptedOrder:"پذیرفته‌شده", rejectedOrder:"ردشده", completedOrder:"تکمیل‌شده", cancelledOrder:"لغوشده", acceptOrder:"پذیرش", rejectOrder:"رد سفارش", completeOrder:"تکمیل سفارش", cancelOrder:"لغو سفارش", orderCreated:"درخواست سفارش برای فروشنده ارسال شد.", orderUpdated:"وضعیت سفارش تغییر کرد.", noOrders:"هنوز سفارشی ثبت نشده است.", buyer:"خریدار", seller:"فروشنده", orderFailed:"ثبت یا تغییر سفارش انجام نشد." },
  en: { open:"Marketplace", title:"Houshyar Marketplace", subtitle:"Browse approved shops or apply to open your own store.", close:"Close", browse:"Browse products", seller:"Seller dashboard", search:"Search products or shops…", find:"Search", city:"City (optional)", allModes:"Any fulfillment", delivery:"Home delivery", pickup:"Pickup", near:"Near me", locating:"Getting your location…", locationDenied:"Location access was not granted; you can enter a city instead.", distance:"Distance", stockAvailable:"In stock", outOfStock:"Out of stock", order:"Order", deliveryAvailable:"Delivery available", pickupAvailable:"Pickup available", limited:"Results are capped; narrow the search by city or keyword.", loading:"Loading…", empty:"No products are available yet.", foundItems:"Found items", missingItems:"Not found", coveredStores:"Stores with the most requested items", more:"Load more", login:"Sign in to access the seller dashboard.", account:"Open account", applyTitle:"Apply for a store", storeName:"Store name", slug:"Short URL slug (e.g. aria-shop)", description:"Store description", apply:"Submit application", pending:"Your store application is awaiting administrator review.", suspended:"This store is temporarily suspended.", active:"Your store is approved.", productTitle:"Product name", category:"Category slug (e.g. fashion)", price:"Price in IRR", stock:"Stock quantity", productDescription:"Product description", createProduct:"Save product", products:"My products", draft:"Draft", published:"Published", publish:"Publish product", noProducts:"You have not added products yet.", submitted:"Application submitted.", created:"Product saved as a draft.", publishedDone:"Product published.", requestFailed:"Request failed. Please try again.", catalogUnavailable:"The catalog is temporarily unavailable.", currency:"IRR", store:"Store", noStore:"You do not have a store yet.", priceInvalid:"Price must be a positive whole number.", stockInvalid:"Stock must be a non-negative whole number.", notReady:"The marketplace database is not configured in this deployment yet.", note:"Orders are requests to sellers in this version; online checkout and image uploads are not enabled.", orders:"Orders", orderRequest:"Request order", quantity:"Quantity", pendingOrder:"Awaiting seller", acceptedOrder:"Accepted", rejectedOrder:"Rejected", completedOrder:"Completed", cancelledOrder:"Cancelled", acceptOrder:"Accept", rejectOrder:"Reject", completeOrder:"Complete", cancelOrder:"Cancel", orderCreated:"Order request sent to the seller.", orderUpdated:"Order status updated.", noOrders:"No orders yet.", buyer:"Buyer", seller:"Seller", orderFailed:"Could not create or update the order." }
};
const copyFor = locale => COPY[locale] || COPY.en;
const shoppingTerms = value => {
  const normalized = String(value || "").normalize("NFKC").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u064B-\u065F\u0670]/g, "").toLowerCase();
  const filler = new Set(["برای", "میخواهم", "میخوام", "می‌خواهم", "می‌خوام", "لطفا", "لطفاً", "بخر", "خرید", "لازم", "نیاز", "دارم", "میخریم", "می‌خرم", "میخرم", "شام", "ناهار", "صبحانه"]);
  return [...new Set(normalized.split(/[,،;؛+]|\s+و\s+/).map(part =>
    part.split(/\s+/).filter(word => word && !filler.has(word)).join(" ").trim()
  ).filter(term => term.length >= 2))].slice(0, 10);
};
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const money = (value, locale) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale || "en", { maximumFractionDigits:0 }).format(Number(value) || 0);

export function summarizeShoppingResults(terms, products) {
  const requested = [...new Set((Array.isArray(terms) ? terms : []).filter(term => typeof term === "string" && term.trim()).map(term => term.trim()))].slice(0, 10);
  const rows = Array.isArray(products) ? products : [];
  const itemGroups = requested.map(term => ({
    term,
    products: rows.filter(product => Array.isArray(product.matchedTerms) && product.matchedTerms.includes(term))
  }));
  const missingTerms = itemGroups.filter(group => group.products.length === 0).map(group => group.term);
  const stores = new Map();
  for (const product of rows) {
    const id = String(product.storeId || product.storeName || "unknown");
    const entry = stores.get(id) || { storeId:id, storeName:String(product.storeName || ""), matchedTerms:new Set(), products:[] };
    for (const term of (product.matchedTerms || [])) if (requested.includes(term)) entry.matchedTerms.add(term);
    entry.products.push(product);
    stores.set(id, entry);
  }
  const storeCoverage = [...stores.values()].map(store => ({
    storeId:store.storeId, storeName:store.storeName, matchedTerms:[...store.matchedTerms], itemCount:store.matchedTerms.size, products:store.products
  })).sort((a,b) => b.itemCount - a.itemCount || b.products.length - a.products.length || a.storeName.localeCompare(b.storeName));
  return { itemGroups, missingTerms, storeCoverage };
}

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
    '<nav class="marketplace-tabs" aria-label="' + c.title + '"><button type="button" data-market-tab="browse" class="active">' + c.browse + '</button><button type="button" data-market-tab="seller">' + c.seller + '</button><button type="button" data-market-tab="orders">' + c.orders + '</button></nav>' +
    '<div class="marketplace-status" role="status" aria-live="polite"></div>' +
    '<section data-market-view="browse"><form class="marketplace-search"><input name="q" maxlength="80" placeholder="' + c.search + '" aria-label="' + c.search + '"><input name="city" maxlength="80" placeholder="' + c.city + '" aria-label="' + c.city + '"><select name="mode" aria-label="' + c.allModes + '"><option value="">' + c.allModes + '</option><option value="delivery">' + c.delivery + '</option><option value="pickup">' + c.pickup + '</option></select><button type="submit">' + c.find + '</button><button type="button" data-market-near>' + c.near + '</button></form><div class="marketplace-shopping-summary" aria-live="polite"></div><div class="marketplace-products" aria-live="polite"></div><button type="button" class="marketplace-more" hidden>' + c.more + '</button></section>' +
    '<section data-market-view="seller" hidden><div class="marketplace-seller-content"></div></section><section data-market-view="orders" hidden><div class="marketplace-orders-content"></div></section><p class="marketplace-note">' + c.note + '</p></div>';
  app.append(overlay);
  const status = overlay.querySelector(".marketplace-status");
  const productsNode = overlay.querySelector(".marketplace-products");
  const shoppingSummary = overlay.querySelector(".marketplace-shopping-summary");
  let catalogProducts = [];
  const sellerNode = overlay.querySelector(".marketplace-seller-content");
  const ordersNode = overlay.querySelector(".marketplace-orders-content");
  const more = overlay.querySelector(".marketplace-more");
  let offset = 0, query = "", city = "", mode = "", coordinates = null;
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
    if (tab === "orders") loadOrders();
  };
  const productCard = product => {
    const place = [product.city, product.region].filter(Boolean).join(" · ");
    const distance = Number.isFinite(product.distanceKm) ? '<small>' + c.distance + ': ' + escape(product.distanceKm) + ' km</small>' : '';
    const stockAvailable = Number.isSafeInteger(Number(product.stockCount)) && Number(product.stockCount) > 0;
    const stockInfo = '<small class="marketplace-stock ' + (stockAvailable ? 'is-available' : 'is-unavailable') + '">' + (stockAvailable ? c.stockAvailable : c.outOfStock) + '</small>';
    const matched = Array.isArray(product.matchedTerms) && product.matchedTerms.length ? '<small class="marketplace-match">' + escape(product.matchedTerms.join("، ")) + '</small>' : "";
    const fulfillment = (product.offersDelivery ? '<small>' + c.deliveryAvailable + '</small>' : '') + (product.offersPickup ? '<small>' + c.pickupAvailable + '</small>' : '');
    let orderLink = '';
    try { const orderUrl = new URL(product.orderUrl); if (orderUrl.protocol === 'https:') orderLink = '<a href="' + escape(orderUrl.href) + '" target="_blank" rel="noopener noreferrer">' + c.order + '</a>'; } catch {}
    const modes = (product.offersDelivery ? '<option value="delivery">' + c.delivery + '</option>' : '') + (product.offersPickup ? '<option value="pickup">' + c.pickup + '</option>' : '');
    const orderForm = modes && stockAvailable ? '<form class="marketplace-order-form" data-order-create><input type="hidden" name="productId" value="' + escape(product.productId) + '"><select name="fulfillmentMode" aria-label="' + c.allModes + '">' + modes + '</select><input name="quantity" type="number" min="1" max="100" value="1" aria-label="' + c.quantity + '"><button type="submit">' + c.orderRequest + '</button></form>' : '';
    return '<article class="marketplace-product"><div class="marketplace-product-art" aria-hidden="true">✧</div><div class="marketplace-product-info">' +
      '<span class="marketplace-category">' + escape(product.category) + '</span><h3>' + escape(product.title) + '</h3><p>' + escape(product.description || '') + '</p><strong>' +
      money(product.priceMinor, locale) + ' ' + escape(product.currency || c.currency) + '</strong><small>' + c.store + ': ' + escape(product.storeName || '') + '</small>' +
      (place ? '<small>' + escape(place) + '</small>' : '') + distance + matched + stockInfo + fulfillment + orderLink + orderForm + '</div></article>';
  };
  async function loadCatalog(reset = false) {
    if (reset) { offset = 0; catalogProducts = []; productsNode.innerHTML = ""; shoppingSummary.innerHTML = ""; }
    say(c.loading); more.hidden = true;
    try {
      const params = new URLSearchParams({ limit:"12", offset:String(offset) });
      const terms = shoppingTerms(query);
      if (terms.length > 1) terms.forEach(term => params.append("item", term));
      else if (query) params.set("q", query);
      if (city) params.set("city", city);
      if (mode) params.set("mode", mode);
      if (coordinates) { params.set("lat", String(coordinates.latitude)); params.set("lon", String(coordinates.longitude)); }
      const data = await request("/api/stores?" + params.toString());
      catalogProducts.push(...(data.products || []));
      productsNode.insertAdjacentHTML("beforeend", (data.products || []).map(productCard).join(""));
      if (terms.length > 1) {
        const summary = summarizeShoppingResults(terms, catalogProducts);
        const found = summary.itemGroups.filter(group => group.products.length).map(group => "<li><b>" + escape(group.term) + "</b>: " + group.products.length + "</li>").join("");
        const missing = summary.missingTerms.length ? "<p><b>" + c.missingItems + ":</b> " + summary.missingTerms.map(escape).join("، ") + "</p>" : "";
        const stores = summary.storeCoverage.filter(store => store.itemCount > 1).slice(0, 3).map(store => "<li>" + escape(store.storeName) + " — " + store.itemCount + " " + escape(c.foundItems) + "</li>").join("");
        shoppingSummary.innerHTML = "<section class=\\"marketplace-summary-card\\"><b>" + c.foundItems + "</b><ul>" + (found || "<li>" + c.empty + "</li>") + "</ul>" + missing + (stores ? "<b>" + c.coveredStores + "</b><ul>" + stores + "</ul>" : "") + "</section>";
      }
      offset += (data.products || []).length;
      more.hidden = data.hasMore !== true;
      say(data.truncated ? c.limited : ((data.products || []).length || offset ? "" : c.empty));
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
  const orderStatus = status => ({ pending:c.pendingOrder, accepted:c.acceptedOrder, rejected:c.rejectedOrder, completed:c.completedOrder, cancelled:c.cancelledOrder })[status] || status;
  function renderOrders(data) {
    const rows = (data.orders || []).map(order => {
      const buyerSide = order.viewerRole === "buyer";
      const actions = buyerSide && order.status === "pending"
        ? '<button type="button" data-order-action="cancel" data-order-id="' + escape(order.id) + '">' + c.cancelOrder + '</button>'
        : !buyerSide && order.status === "pending"
          ? '<button type="button" data-order-action="accept" data-order-id="' + escape(order.id) + '">' + c.acceptOrder + '</button><button type="button" data-order-action="reject" data-order-id="' + escape(order.id) + '">' + c.rejectOrder + '</button>'
          : !buyerSide && order.status === "accepted"
            ? '<button type="button" data-order-action="complete" data-order-id="' + escape(order.id) + '">' + c.completeOrder + '</button>' : '';
      return '<article class="marketplace-order"><div><b>' + escape(order.productTitle) + '</b><small>' + escape(order.storeName) + ' · ' + escape(order.quantity) + ' × ' + money(order.unitPriceMinor, locale) + ' ' + escape(order.currency) + '</small><small>' + (buyerSide ? c.buyer : c.seller) + ' · ' + escape(order.fulfillmentMode) + '</small><small>' + escape(order.buyerNote || '') + '</small></div><span class="marketplace-state">' + escape(orderStatus(order.status)) + '</span>' + actions + '</article>';
    }).join("");
    ordersNode.innerHTML = rows || '<p>' + c.noOrders + '</p>';
  }
  async function loadOrders() {
    ordersNode.innerHTML = ""; say(c.loading);
    try { const data = await request("/api/store/orders"); renderOrders(data); say(""); }
    catch (error) { say(error.status === 401 ? c.login : c.orderFailed); }
  }
  async function updateOrder(button) {
    button.disabled = true; say(c.loading);
    try {
      await request("/api/store/orders/update", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ orderId:button.dataset.orderId, action:button.dataset.orderAction }) });
      say(c.orderUpdated); await loadOrders();
    } catch { say(c.orderFailed); button.disabled = false; }
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
  overlay.querySelector(".marketplace-search").addEventListener("submit", event => { event.preventDefault(); query = event.currentTarget.elements.q.value.trim(); city = event.currentTarget.elements.city.value.trim(); mode = event.currentTarget.elements.mode.value; loadCatalog(true); });
  overlay.querySelector("[data-market-near]").addEventListener("click", () => {
    if (!navigator.geolocation?.getCurrentPosition) { say(c.locationDenied); return; }
    say(c.locating);
    navigator.geolocation.getCurrentPosition(position => {
      coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      loadCatalog(true);
    }, () => say(c.locationDenied), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });
  more.addEventListener("click", () => loadCatalog(false));
  overlay.addEventListener("submit", async event => {
    const form = event.target;
    if (form.matches("[data-order-create]")) {
      event.preventDefault();
      const quantity = Number(form.elements.quantity.value);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) { say(c.orderFailed); return; }
      const button = form.querySelector("button[type=submit]"); button.disabled = true; say(c.loading);
      try {
        await request("/api/store/orders", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ productId:form.elements.productId.value, quantity, fulfillmentMode:form.elements.fulfillmentMode.value }) });
        say(c.orderCreated); form.reset(); form.elements.quantity.value = "1"; button.disabled = false;
      } catch (error) { say(error.status === 401 ? c.login : c.orderFailed); button.disabled = false; }
    }
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
