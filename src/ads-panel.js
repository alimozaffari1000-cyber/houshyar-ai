const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));

export function initAdsPanel(container, user) {
  if (!container || container.querySelector("#ads-marketplace")) return;
  const root = document.createElement("section");
  root.id = "ads-marketplace";
  root.className = "ads-marketplace";
  root.innerHTML = `
    <div class="ads-panel-head"><div><strong>بازار تبلیغات و پاداش</strong><p>ثبت کمپین، دعوت دوستان و مشاهده اعتبار خدماتی</p></div><button type="button" id="ads-refresh">بروزرسانی</button></div>
    <p id="ads-status" class="account-muted" role="status">در حال بررسی وضعیت بازار تبلیغات…</p>
    <div class="ads-stats">
      <div><small>اعتبار پاداش</small><strong id="ads-balance">—</strong><small>اعتبار خدماتی؛ غیرقابل برداشت</small></div>
      <div><small>دعوت‌های ثبت‌شده</small><strong id="ads-referrals">—</strong><small id="ads-qualified">دعوت تأییدشده: —</small></div>
    </div>
    <div class="ads-referral"><b>کد دعوت شما</b><div><code id="ads-code">—</code><button type="button" id="ads-copy" disabled>کپی کد</button></div></div>
    <form id="ads-referral-form" class="ads-referral-entry">
      <label>کد دعوتی که دریافت کرده‌اید<input name="code" maxlength="20" minlength="10" pattern="[A-Za-z0-9]{10,20}" required></label>
      <button type="submit">ثبت کد دعوت</button>
    </form>
    <form id="ads-campaign-form">
      <h4>ثبت کمپین تبلیغاتی</h4>
      <label>عنوان تبلیغ<input name="title" maxlength="100" required></label>
      <label>توضیح تبلیغ<textarea name="description" maxlength="2000" rows="3" required></textarea></label>
      <label>لینک مقصد (فقط HTTPS)<input name="destinationUrl" type="url" maxlength="2048" placeholder="https://example.com" required></label>
      <label>روش قیمت‌گذاری<select name="pricingModel"><option value="cpc">هزینه به‌ازای کلیک (CPC)</option><option value="cpm">هزینه به‌ازای هزار نمایش (CPM)</option><option value="cpa">هزینه به‌ازای اقدام (CPA)</option><option value="barter">تبادل تبلیغاتی</option></select></label>
      <button type="submit" class="account-submit">ارسال برای بررسی</button>
      <p class="account-muted">ارسال فرم به معنی فعال‌شدن تبلیغ یا پرداخت وجه نیست. هر کمپین باید ابتدا توسط مدیر تأیید شود.</p>
    </form>
    <div class="ads-campaigns"><h4>کمپین‌های من</h4><div id="ads-campaign-list" class="account-muted">هنوز بارگذاری نشده است.</div></div>
    <div class="ads-analytics"><h4>گزارش عملکرد و درآمد</h4><div id="ads-analytics-list" class="account-muted">گزارش هنوز بارگذاری نشده است.</div><small class="account-muted">درآمد فقط از تسویه‌های تأییدشده محاسبه می‌شود؛ سهم ۵٪ نمایشی است و هنوز پرداخت نشده است.</small></div>
    <div id="ads-review" hidden><h4>صف بررسی مدیر</h4><div id="ads-review-list"></div></div>`;
  container.append(root);

  const status = root.querySelector("#ads-status");
  const setStatus = message => { status.textContent = message; };
  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || (data.error === "ADS_NOT_CONFIGURED" ? "بازار تبلیغات هنوز روی سرور فعال نشده است." : "درخواست انجام نشد."));
    return data;
  };

  async function refresh() {
    setStatus("در حال دریافت اطلاعات…");
    const results = await Promise.allSettled([
      request("/api/ads/referrals"),
      request("/api/ads/rewards"),
      request("/api/ads/campaigns")
    ]);
    const failed = results.find(result => result.status === "rejected");
    if (failed) {
      setStatus(failed.reason?.message || "بازار تبلیغات فعلاً در دسترس نیست.");
      return;
    }
    const [referrals, rewards, campaigns] = results.map(result => result.value);
    root.querySelector("#ads-balance").textContent = Number(rewards.balanceUnits || 0).toLocaleString("fa-IR") + " واحد";
    root.querySelector("#ads-referrals").textContent = Number(referrals.total || 0).toLocaleString("fa-IR");
    root.querySelector("#ads-qualified").textContent = "دعوت تأییدشده: " + Number(referrals.qualified || 0).toLocaleString("fa-IR");
    root.querySelector("#ads-code").textContent = referrals.code || "—";
    root.querySelector("#ads-copy").disabled = !referrals.code;
    root.querySelector("#ads-campaign-list").innerHTML = campaigns.campaigns?.length
      ? campaigns.campaigns.map(item => `<article class="ads-campaign-row"><b>${safe(item.title)}</b><span>${safe(item.status)}</span><small>${safe(item.pricing_model)} · ${safe(item.currency_code)} ${safe(item.budget_minor)}</small></article>`).join("")
      : "هنوز کمپینی ثبت نشده است.";
    setStatus("اطلاعات بازار تبلیغات بروزرسانی شد. تبلیغ و پاداش واقعی فقط پس از فعال‌سازی رسمی امکان‌پذیر است.");
    await loadAnalytics();
    if (user?.role === "admin") await loadReview();
  }

  async function loadAnalytics() {
    const list = root.querySelector("#ads-analytics-list");
    list.textContent = "در حال دریافت گزارش…";
    try {
      const data = await request("/api/ads/analytics");
      const rows = Array.isArray(data.campaigns) ? data.campaigns : [];
      if (!rows.length) {
        list.textContent = "هنوز دادهٔ عملکرد یا تسویهٔ تأییدشده‌ای برای نمایش وجود ندارد.";
        return;
      }
      list.innerHTML = rows.map(item => `
        <article class="ads-campaign-row ads-analytics-row">
          <b>${safe(item.title)}</b>
          <span>${safe(item.status)}</span>
          <div class="ads-analytics-grid">
            <div><small>نمایش معتبر</small><strong>${Number(item.valid_impressions || 0).toLocaleString("fa-IR")}</strong></div>
            <div><small>کلیک معتبر</small><strong>${Number(item.valid_clicks || 0).toLocaleString("fa-IR")}</strong></div>
            <div><small>نرخ کلیک</small><strong>${Number(item.ctr_percent || 0).toLocaleString("fa-IR")}%</strong></div>
            <div><small>رویداد در بررسی</small><strong>${Number(item.pending_events || 0).toLocaleString("fa-IR")}</strong></div>
            <div><small>رویداد ردشده</small><strong>${Number(item.rejected_events || 0).toLocaleString("fa-IR")}</strong></div>
            <div><small>تسویه خالص تأییدشده</small><strong>${Number(item.net_settled_minor || 0).toLocaleString("fa-IR")} ${safe(item.currency_code)} (واحد خرد)</strong></div>
            <div><small>سهم نظری ۵٪</small><strong>${Number(item.reward_pool_minor || 0).toLocaleString("fa-IR")} (واحد خرد)</strong></div>
          </div>
        </article>`).join("");
      if (data.rewardsIssued !== false) {
        list.insertAdjacentHTML("beforeend", '<p class="account-muted">وضعیت پرداخت پاداش از API تأیید نشده است.</p>');
      }
    } catch (error) {
      list.textContent = error.message || "گزارش عملکرد فعلاً در دسترس نیست.";
    }
  }

  async function loadReview() {
    const box = root.querySelector("#ads-review");
    const list = root.querySelector("#ads-review-list");
    box.hidden = false;
    try {
      const data = await request("/api/ads/review");
      list.innerHTML = data.pending?.length ? data.pending.map(item => `
        <article class="ads-campaign-row"><b>${safe(item.title)}</b><p>${safe(item.destination_url)}</p>
        <button type="button" data-review="approve" data-id="${safe(item.id)}">تأیید</button>
        <button type="button" data-review="reject" data-id="${safe(item.id)}">رد</button></article>`).join("") : '<p class="account-muted">کمپین در انتظار بررسی وجود ندارد.</p>';
    } catch (error) { list.textContent = error.message; }
  }

  root.querySelector("#ads-refresh").addEventListener("click", refresh);
  root.querySelector("#ads-copy").addEventListener("click", async () => {
    const code = root.querySelector("#ads-code").textContent;
    try { await navigator.clipboard.writeText(code); setStatus("کد دعوت کپی شد."); }
    catch { setStatus("کپی خودکار در دسترس نیست؛ کد را دستی کپی کنید."); }
  });
  root.querySelector("#ads-referral-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    setStatus("در حال ثبت کد دعوت…");
    try {
      const values = new FormData(form);
      await request("/api/ads/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: values.get("code") })
      });
      form.reset();
      setStatus("کد دعوت ثبت شد؛ پاداش پس از احراز شرایط معتبر می‌شود.");
      await refresh();
    } catch (error) { setStatus(error.message); }
    finally { submit.disabled = false; }
  });
  root.querySelector("#ads-campaign-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    setStatus("در حال ارسال کمپین…");
    try {
      const values = new FormData(form);
      await request("/api/ads/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.get("title"),
          description: values.get("description"),
          destinationUrl: values.get("destinationUrl"),
          pricingModel: values.get("pricingModel"),
          budgetMinor: 0,
          currencyCode: "USD"
        })
      });
      form.reset();
      setStatus("کمپین برای بررسی ارسال شد.");
      await refresh();
    } catch (error) { setStatus(error.message); }
    finally { submit.disabled = false; }
  });
  root.addEventListener("click", async event => {
    const button = event.target.closest("[data-review]");
    if (!button) return;
    button.disabled = true;
    try {
      await request("/api/ads/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: button.dataset.id, decision: button.dataset.review })
      });
      await loadReview();
    } catch (error) { setStatus(error.message); button.disabled = false; }
  });
  refresh();
}
