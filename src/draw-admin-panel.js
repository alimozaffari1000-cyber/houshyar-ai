const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

export function initDrawAdminPanel(container) {
  if (!container || container.dataset.initialized) return;
  container.dataset.initialized = "true";
  const root = document.createElement("section");
  root.className = "draw-admin";
  root.innerHTML = `
    <div class="draw-admin-head"><h3>مدیریت قرعه‌کشی</h3><button type="button" id="draw-admin-refresh">بروزرسانی</button></div>
    <p id="draw-admin-status" class="account-muted" role="status">در حال دریافت دوره‌ها…</p>
    <form id="draw-admin-create">
      <h4>ساخت دوره رایگان</h4>
      <label>عنوان<input name="title" maxlength="120" minlength="3" required></label>
      <label>توضیح<textarea name="description" maxlength="3000" rows="2"></textarea></label>
      <label>شرح جایزه<input name="prizeDescription" maxlength="500" required></label>
      <label>کد کشور/حوزه قضایی<input name="jurisdictionCode" value="DE" maxlength="16" required></label>
      <label>حداکثر بلیت<input name="maxEntries" type="number" min="1" max="1000000" value="10000" required></label>
      <label>شروع ثبت‌نام<input name="startsAt" type="datetime-local"></label>
      <label>پایان ثبت‌نام<input name="endsAt" type="datetime-local" required></label>
      <label>زمان قرعه‌کشی<input name="drawAt" type="datetime-local" required></label>
      <button type="submit" class="account-submit">ایجاد پیش‌نویس</button>
      <p class="account-muted">این ابزار فقط دوره رایگان می‌سازد. پرداخت ورودی و جایزه نقدی در این نسخه وجود ندارد.</p>
    </form>
    <div id="draw-admin-list"></div>`;
  container.append(root);
  const status = root.querySelector("#draw-admin-status");
  const list = root.querySelector("#draw-admin-list");
  async function request(url, options) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || "درخواست مدیریت قرعه‌کشی ناموفق بود.");
    return data;
  }
  const iso = value => value ? new Date(value).toISOString() : null;
  async function refresh() {
    status.textContent = "در حال دریافت دوره‌ها…";
    try {
      const data = await request("/api/draws/admin/campaigns");
      list.innerHTML = data.campaigns?.length ? data.campaigns.map(item => `
        <article class="draw-admin-row">
          <b>${safe(item.title)}</b><span>${safe(item.status)} · ${Number(item.participants || 0).toLocaleString("fa-IR")} شرکت‌کننده · ${Number(item.eligible_entries || 0).toLocaleString("fa-IR")} بلیت</span>
          <small>راستی‌آزمایی: ${safe(item.verification_status || "انجام نشده")}</small>
          <div class="draw-admin-actions">
            ${item.status === "draft" ? '<button data-action="open" data-id="' + safe(item.id) + '">بازکردن ثبت‌نام</button>' : ""}
            ${["draft","open","scheduled"].includes(item.status) ? '<button data-action="cancel" data-id="' + safe(item.id) + '">لغو دوره</button>' : ""}
            ${item.status === "open" ? '<button data-action="execute" data-id="' + safe(item.id) + '">اجرای قرعه‌کشی</button>' : ""}
            ${item.status === "drawn" && item.verification_status !== "verified" ? '<button data-action="verify" data-id="' + safe(item.id) + '">راستی‌آزمایی سرور</button>' : ""}
          </div>
        </article>`).join("") : '<p class="account-muted">هنوز دوره‌ای ساخته نشده است.</p>';
      status.textContent = "فهرست مدیریت به‌روزرسانی شد.";
    } catch (error) { status.textContent = error.message; }
  }
  root.querySelector("#draw-admin-refresh").addEventListener("click", refresh);
  root.querySelector("#draw-admin-create").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const values = new FormData(form);
      await request("/api/draws/admin/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.get("title"), description: values.get("description"),
          prizeDescription: values.get("prizeDescription"), jurisdictionCode: values.get("jurisdictionCode"),
          maxEntries: Number(values.get("maxEntries")), entriesPerUser: 1,
          startsAt: iso(values.get("startsAt")), endsAt: iso(values.get("endsAt")), drawAt: iso(values.get("drawAt"))
        })
      });
      form.reset();
      status.textContent = "پیش‌نویس دوره ساخته شد. برای انتشار، ثبت‌نام آن را باز کنید.";
      await refresh();
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  root.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    button.disabled = true;
    const action = button.dataset.action;
    const campaignId = button.dataset.id;
    try {
      if (action === "open" || action === "cancel") {
        await request("/api/draws/admin/review", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, action })
        });
        status.textContent = action === "open" ? "ثبت‌نام دوره باز شد." : "دوره لغو شد.";
      } else {
        const endpoint = action === "execute" ? "execute" : "verify";
        const result = await request("/api/draws/admin/" + endpoint, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId })
        });
        status.textContent = action === "execute"
          ? "قرعه‌کشی انجام شد؛ اکنون باید نتیجه را راستی‌آزمایی کنید."
          : result.verified ? "راستی‌آزمایی بازپخش سرور موفق بود. این جایگزین ممیزی مستقل نیست." : "راستی‌آزمایی ناموفق بود؛ نتیجه عمومی نمی‌شود.";
      }
      await refresh();
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  refresh();
}
