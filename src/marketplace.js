const COPY = {
  fa: { open:"بازارگاه", title:"بازارگاه هوش‌یار", subtitle:"محصولات فروشگاه‌های تأییدشده را ببین یا فروشگاه خودت را راه‌اندازی کن.", close:"بستن", browse:"فروشگاه‌ها", seller:"پنل فروشنده", search:"جست‌وجوی محصول یا فروشگاه…", find:"جست‌وجو", loading:"در حال دریافت اطلاعات…", empty:"هنوز محصولی برای نمایش وجود ندارد.", more:"محصولات بیشتر", login:"برای ورود به پنل فروشنده ابتدا وارد حساب شو.", account:"ورود به حساب", applyTitle:"درخواست ایجاد فروشگاه", storeName:"نام فروشگاه", slug:"نشانی کوتاه انگلیسی (مثلاً aria-shop)", description:"معرفی فروشگاه", apply:"ارسال درخواست", pending:"درخواست فروشگاهت برای بررسی مدیر ارسال شده است.", suspended:"این فروشگاه موقتاً غیرفعال است.", active:"فروشگاه تأیید شده است.", productTitle:"نام محصول", category:"دسته‌بندی انگلیسی (مثلاً fashion)", price:"قیمت به ریال", stock:"موجودی", productDescription:"توضیحات محصول", createProduct:"ثبت محصول", products:"محصولات من", draft:"پیش‌نویس", published:"منتشرشده", publish:"انتشار محصول", noProducts:"هنوز محصولی ثبت نکرده‌ای.", submitted:"درخواست ثبت شد.", created:"محصول به‌صورت پیش‌نویس ثبت شد.", publishedDone:"محصول منتشر شد.", requestFailed:"درخواست انجام نشد. دوباره تلاش کن.", catalogUnavailable:"دریافت فروشگاه‌ها موقتاً ممکن نیست.", currency:"ریال", store:"فروشگاه", noStore:"هنوز فروشگاهی ثبت نکرده‌ای.", priceInvalid:"قیمت باید عدد صحیح و بیشتر از صفر باشد.", stockInvalid:"موجودی باید عدد صحیح و صفر یا بیشتر باشد.", notReady:"پایگاه داده فروشگاه هنوز در محیط انتشار راه‌اندازی نشده است.", note:"پرداخت آنلاین هنوز فعال نیست؛ سفارش‌ها فعلاً با وضعیت پرداخت‌نشده ثبت می‌شوند.", addCart:"افزودن به سبد", cartTitle:"سبد خرید", emptyCart:"سبد خرید خالی است.", remove:"حذف", checkout:"ثبت سفارش", recipient:"نام تحویل‌گیرنده", phoneLabel:"شماره تماس", address:"نشانی تحویل", noteLabel:"توضیحات سفارش", pickup:"تحویل حضوری", delivery:"ارسال به منزل", orderCreated:"سفارش ثبت شد: ", mixedStore:"هر سفارش فقط می‌تواند شامل کالاهای یک فروشگاه باشد.", orderList:"سفارش‌های دریافتی", confirmOrder:"تأیید", prepareOrder:"شروع آماده‌سازی", readyOrder:"آماده تحویل", shipOrder:"ثبت ارسال", completeOrder:"تکمیل سفارش", cancelOrder:"لغو سفارش", orderFailed:"ثبت سفارش ناموفق بود." },
  en: { open:"Marketplace", title:"Houshyar Marketplace", subtitle:"Browse approved shops or apply to open your own store.", close:"Close", browse:"Browse products", seller:"Seller dashboard", search:"Search products or shops…", find:"Search", loading:"Loading…", empty:"No products are available yet.", more:"Load more", login:"Sign in to access the seller dashboard.", account:"Open account", applyTitle:"Apply for a store", storeName:"Store name", slug:"Short URL slug (e.g. aria-shop)", description:"Store description", apply:"Submit application", pending:"Your store application is awaiting administrator review.", suspended:"This store is temporarily suspended.", active:"Your store is approved.", productTitle:"Product name", category:"Category slug (e.g. fashion)", price:"Price in IRR", stock:"Stock quantity", productDescription:"Product description", createProduct:"Save product", products:"My products", draft:"Draft", published:"Published", publish:"Publish product", noProducts:"You have not added products yet.", submitted:"Application submitted.", created:"Product saved as a draft.", publishedDone:"Product published.", requestFailed:"Request failed. Please try again.", catalogUnavailable:"The catalog is temporarily unavailable.", currency:"IRR", store:"Store", noStore:"You do not have a store yet.", priceInvalid:"Price must be a positive whole number.", stockInvalid:"Stock must be a non-negative whole number.", notReady:"The marketplace database is not configured in this deployment yet.", note:"Online payments are not enabled; orders are created as unpaid.", addCart:"Add to cart", cartTitle:"Shopping cart", emptyCart:"Your cart is empty.", remove:"Remove", checkout:"Place order", recipient:"Recipient name", phoneLabel:"Phone number", address:"Delivery address", noteLabel:"Order notes", pickup:"Store pickup", delivery:"Home delivery", orderCreated:"Order placed: ", mixedStore:"Each order can contain items from one store only.", orderList:"Incoming orders", confirmOrder:"Confirm", prepareOrder:"Start preparing", readyOrder:"Ready", shipOrder:"Mark shipped", completeOrder:"Complete", cancelOrder:"Cancel order", orderFailed:"Could not place the order." }
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
    '<section data-market-view="browse"><form class="marketplace-search"><input name="q" maxlength="80" placeholder="' + c.search + '" aria-label="' + c.search + '"><input name="city" maxlength="80" placeholder="' + (locale === "fa" ? "نام شهر" : "City") + '"><select name="mode" aria-label="' + (locale === "fa" ? "روش دریافت" : "Fulfillment") + '"><option value="">' + (locale === "fa" ? "همه روش‌ها" : "Any option") + '</option><option value="delivery">' + (locale === "fa" ? "ارسال به منزل" : "Home delivery") + '</option><option value="pickup">' + (locale === "fa" ? "تحویل حضوری" : "Pickup") + '</option></select><button type="submit">' + c.find + '</button><button type="button" data-nearby>' + (locale === "fa" ? "نزدیک من" : "Near me") + '</button></form><div class="marketplace-products" aria-live="polite"></div><section class="marketplace-cart"><h3>' + c.cartTitle + '</h3><div data-cart-items></div><form data-market-checkout hidden><label>' + c.recipient + '<input name="recipientName" minlength="2" maxlength="100" required></label><label>' + c.phoneLabel + '<input name="contactPhone" maxlength="30" required inputmode="tel"></label><label>' + (locale === "fa" ? "روش دریافت" : "Fulfillment") + '<select name="fulfillment"><option value="pickup">' + c.pickup + '</option><option value="delivery">' + c.delivery + '</option></select></label><label data-delivery-address hidden>' + c.address + '<textarea name="deliveryAddress" maxlength="500" rows="2"></textarea></label><label>' + c.noteLabel + '<textarea name="buyerNote" maxlength="500" rows="2"></textarea></label><button type="submit">' + c.checkout + '</button></form></section><button type="button" class="marketplace-more" hidden>' + c.more + '</button></section>' +
    '<section data-market-view="seller" hidden><div class="marketplace-seller-content"></div></section><p class="marketplace-note">' + c.note + '</p></div>';
  app.append(overlay);
  const status = overlay.querySelector(".marketplace-status");
  const productsNode = overlay.querySelector(".marketplace-products");
  const sellerNode = overlay.querySelector(".marketplace-seller-content");
  const more = overlay.querySelector(".marketplace-more");
  const cartNode = overlay.querySelector("[data-cart-items]");
  const checkoutForm = overlay.querySelector("[data-market-checkout]");
  const cart = new Map();
  const catalogProducts = new Map();
  let offset = 0, query = "", stateLocation = null, loadingCatalog = false;
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
  const productCard = product => {
    const distance = Number.isFinite(product.distanceKm) ? '<small>' + (locale === "fa" ? "فاصله: " : "Distance: ") + money(product.distanceKm, locale) + ' km</small>' : "";
    const fulfillment = [product.offersDelivery ? (locale === "fa" ? "ارسال دارد" : "Delivery") : "", product.offersPickup ? (locale === "fa" ? "تحویل حضوری" : "Pickup") : ""].filter(Boolean).join(" · ");
    const orderUrl = typeof product.orderUrl === "string" && /^https:\/\//i.test(product.orderUrl) ? '<a href="' + escape(product.orderUrl) + '" target="_blank" rel="noopener noreferrer">' + (locale === "fa" ? "سفارش آنلاین" : "Order online") + '</a>' : "";
    const phone = typeof product.contactPhone === "string" && /^[+0-9() .-]{6,30}$/.test(product.contactPhone) ? '<a href="tel:' + escape(product.contactPhone) + '">' + (locale === "fa" ? "تماس" : "Call") + '</a>' : "";
    return '<article class="marketplace-product"><div class="marketplace-product-art" aria-hidden="true">✧</div><div class="marketplace-product-info">' +
      '<span class="marketplace-category">' + escape(product.category) + '</span><h3>' + escape(product.title) + '</h3><p>' + escape(product.description || "") + '</p><strong>' +
      money(product.priceMinor, locale) + ' ' + escape(product.currency || c.currency) + '</strong><small>' + c.store + ': ' + escape(product.storeName || "") + '</small><small>' + escape([product.city, product.region].filter(Boolean).join(" · ")) + '</small><small>' + escape(fulfillment) + '</small>' + distance + '<div>' + orderUrl + ' ' + phone + '</div><button type="button" data-cart-add="' + escape(product.id) + '">' + c.addCart + '</button></div></article>';
  };
  function renderCart() {
    if (!cart.size) { cartNode.innerHTML = "<p>" + c.emptyCart + "</p>"; checkoutForm.hidden = true; return; }
    cartNode.innerHTML = [...cart.values()].map(item => '<div class="marketplace-cart-row"><span>' + escape(item.title) + " × " + item.quantity + '</span><strong>' + money(item.priceMinor * item.quantity, locale) + " " + escape(item.currency) + '</strong><button type="button" data-cart-remove="' + escape(item.id) + '">' + c.remove + "</button></div>").join("");
    checkoutForm.hidden = false;
    const delivery = checkoutForm.elements.fulfillment.value === "delivery";
    checkoutForm.querySelector("[data-delivery-address]").hidden = !delivery;
    checkoutForm.elements.deliveryAddress.required = delivery;
  }
  async function loadCatalog(reset = false) {
    if (loadingCatalog) return;
    if (reset) { offset = 0; productsNode.innerHTML = ""; }
    loadingCatalog = true;
    say(c.loading); more.hidden = true;
    try {
      const params = new URLSearchParams({ limit:"30", offset:String(offset) });
      if (query) params.set("q", query);
      const city = overlay.querySelector('[name="city"]').value.trim();
      const mode = overlay.querySelector('[name="mode"]').value;
      if (city) params.set("city", city);
      if (mode) params.set("mode", mode);
      if (stateLocation) { params.set("lat", String(stateLocation.latitude)); params.set("lon", String(stateLocation.longitude)); }
      const data = await request("/api/stores?" + params.toString());
      const products = Array.isArray(data.products) ? data.products : [];
      products.forEach(product => catalogProducts.set(product.id, product));
      productsNode.insertAdjacentHTML("beforeend", products.map(productCard).join(""));
      offset += products.length;
      more.hidden = products.length < 30;
      say(offset ? "" : c.empty);
    } catch (error) { say(error.status === 503 ? c.catalogUnavailable : c.requestFailed); }
    finally { loadingCatalog = false; }
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
    const profileForm = store.status === "active" ? '<div class="marketplace-form-card"><h3>' + (locale === "fa" ? "موقعیت و روش تحویل فروشگاه" : "Store location & fulfillment") + '</h3><form data-store-profile>' +
      '<label>' + (locale === "fa" ? "شهر" : "City") + '<input name="city" minlength="2" maxlength="80" required value="' + escape(store.city || "") + '"></label>' +
      '<label>' + (locale === "fa" ? "استان / منطقه" : "Region") + '<input name="region" maxlength="80" value="' + escape(store.region || "") + '"></label>' +
      '<label>' + (locale === "fa" ? "نشانی عمومی فروشگاه" : "Public address") + '<input name="publicAddress" maxlength="240" value="' + escape(store.publicAddress || "") + '"></label>' +
      '<label>Latitude<input name="latitude" type="number" min="-90" max="90" step="any" value="' + (store.latitude ?? "") + '"></label>' +
      '<label>Longitude<input name="longitude" type="number" min="-180" max="180" step="any" value="' + (store.longitude ?? "") + '"></label>' +
      '<label>' + (locale === "fa" ? "تلفن تماس" : "Contact phone") + '<input name="contactPhone" maxlength="30" value="' + escape(store.contactPhone || "") + '"></label>' +
      '<label>' + (locale === "fa" ? "لینک سفارش آنلاین (HTTPS)" : "Order URL (HTTPS)") + '<input name="orderUrl" type="url" maxlength="500" value="' + escape(store.orderUrl || "") + '" dir="ltr"></label>' +
      '<label><input name="offersDelivery" type="checkbox" ' + (store.offersDelivery ? "checked" : "") + '> ' + (locale === "fa" ? "ارسال به منزل" : "Home delivery") + '</label>' +
      '<label><input name="offersPickup" type="checkbox" ' + (store.offersPickup ? "checked" : "") + '> ' + (locale === "fa" ? "تحویل حضوری" : "Store pickup") + '</label>' +
      '<button type="submit">' + (locale === "fa" ? "ذخیره اطلاعات" : "Save details") + '</button></form></div>' : ""; 
    const rows = (data.products || []).map(product => '<article class="marketplace-seller-product"><div><b>' + escape(product.title) + '</b><small>' +
      escape(product.category) + ' · ' + money(product.priceMinor, locale) + ' ' + escape(product.currency) + '</small></div><span class="marketplace-state">' +
      (product.status === "published" ? c.published : c.draft) + '</span>' +
      (product.status === "draft" && store.status === "active" ? '<button type="button" data-publish="' + escape(product.id) + '">' + c.publish + '</button>' : '') + '</article>').join("");
    sellerNode.innerHTML = '<div class="marketplace-store-state"><b>' + escape(store.name) + '</b><span>' + escape(stateText) + '</span></div>' + profileForm +
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
    const add = event.target.closest("[data-cart-add]");
    if (add) {
      const product = catalogProducts.get(add.dataset.cartAdd);
      if (product) {
        const first = cart.size ? [...cart.values()][0] : null;
        if (first && first.storeId !== product.storeId) say(c.mixedStore);
        else {
          const item = cart.get(product.id) || { id: product.id, title: product.title, priceMinor: product.priceMinor, currency: product.currency, storeId: product.storeId, quantity: 0 };
          item.quantity = Math.min(100, item.quantity + 1);
          cart.set(product.id, item); renderCart(); say("");
        }
      }
    }
    const remove = event.target.closest("[data-cart-remove]");
    if (remove) { cart.delete(remove.dataset.cartRemove); renderCart(); }
  });
  async function publishProduct(button) {
    button.disabled = true; say(c.loading);
    try { await request("/api/store/products/publish", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ productId:button.dataset.publish }) }); say(c.publishedDone); await loadSeller(); }
    catch { say(c.requestFailed); button.disabled = false; }
  }
  overlay.querySelectorAll("[data-market-tab]").forEach(button => button.addEventListener("click", () => showTab(button.dataset.marketTab)));
  overlay.querySelector(".marketplace-search").addEventListener("submit", event => { event.preventDefault(); query = event.currentTarget.elements.q.value.trim(); stateLocation = null; loadCatalog(true); });
  overlay.querySelector("[data-nearby]").addEventListener("click", () => {
    if (!navigator.geolocation) { say(locale === "fa" ? "مکان‌یابی در دسترس نیست." : "Geolocation is unavailable."); return; }
    say(c.loading);
    navigator.geolocation.getCurrentPosition(position => {
      stateLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      loadCatalog(true);
    }, () => say(locale === "fa" ? "مکان‌یابی انجام نشد یا اجازه داده نشد." : "Location permission denied or unavailable."),
    { enableHighAccuracy:false, timeout:10000, maximumAge:300000 });
  });
  more.addEventListener("click", () => loadCatalog(false));
  checkoutForm.elements.fulfillment.addEventListener("change", renderCart);
  renderCart();
  overlay.addEventListener("submit", async event => {
    const form = event.target;
    if (form.matches("[data-market-checkout]")) {
      event.preventDefault();
      const button = form.querySelector("button[type=submit]");
      button.disabled = true; say(c.loading);
      try {
        const data = await request("/api/orders", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
          items:[...cart.values()].map(item => ({ productId:item.id, quantity:item.quantity })),
          fulfillment:form.elements.fulfillment.value,
          recipientName:form.elements.recipientName.value,
          contactPhone:form.elements.contactPhone.value,
          deliveryAddress:form.elements.deliveryAddress.value,
          buyerNote:form.elements.buyerNote.value,
          idempotencyKey:crypto.randomUUID()
        }) });
        cart.clear(); renderCart(); form.reset(); renderCart();
        say(c.orderCreated + data.order.orderNumber);
      } catch (error) {
        if (error.status === 401) say(c.login);
        else if (error.message === "INSUFFICIENT_STOCK" || error.message === "STOCK_OR_PRICE_CHANGED") say(locale === "fa" ? "موجودی یا قیمت تغییر کرده؛ دوباره جست‌وجو کن." : "Stock or price changed. Refresh the catalog.");
        else say(c.orderFailed);
      } finally { button.disabled = false; }
    }
    if (form.matches("[data-store-profile]")) {
      event.preventDefault(); const button = form.querySelector("button[type=submit]"); button.disabled = true; say(c.loading);
      const coordinate = value => value.trim() === "" ? null : Number(value);
      try {
        await request("/api/store/profile", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
          city:form.elements.city.value, region:form.elements.region.value, publicAddress:form.elements.publicAddress.value,
          latitude:coordinate(form.elements.latitude.value), longitude:coordinate(form.elements.longitude.value),
          contactPhone:form.elements.contactPhone.value, orderUrl:form.elements.orderUrl.value,
          offersDelivery:form.elements.offersDelivery.checked, offersPickup:form.elements.offersPickup.checked
        }) });
        say(locale === "fa" ? "اطلاعات فروشگاه ذخیره شد." : "Store details saved."); await loadSeller();
      } catch { say(c.requestFailed); button.disabled = false; }
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
