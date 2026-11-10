import { initAdsPanel } from "./ads-panel.js";
import { initDrawAdminPanel } from "./draw-admin-panel.js";

const safe = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

async function loadConversationHistory(content, status, panel) {
  const list = content.querySelector("#conversation-history");
  if (!list) return;
  list.textContent = "در حال دریافت تاریخچه…";
  try {
    const response = await fetch("/api/conversations", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || (data.error === "HISTORY_NOT_CONFIGURED" ? "ذخیره تاریخچه هنوز روی سرور فعال نشده است." : "دریافت تاریخچه انجام نشد."));
    const conversations = Array.isArray(data.conversations) ? data.conversations : [];
    list.replaceChildren();
    if (!conversations.length) {
      const empty = document.createElement("p");
      empty.className = "history-empty";
      empty.textContent = "هنوز گفتگوی ذخیره‌شده‌ای ندارید. پس از ارسال اولین پیام و دریافت پاسخ، گفتگو در این فهرست ثبت می‌شود.";
      list.append(empty);
      return;
    }
    for (const item of conversations) {
      const row = document.createElement("article");
      row.className = "conversation-row";
      const info = document.createElement("div");
      info.className = "conversation-info";
      const title = document.createElement("strong");
      title.textContent = item.title || "گفتگوی بدون عنوان";
      const meta = document.createElement("small");
      const date = Number(item.updated_at) > 0 ? new Date(Number(item.updated_at) * 1000).toLocaleString("fa-IR") : "";
      meta.textContent = (Number(item.message_count) || 0) + " پیام · " + date;
      info.append(title, meta);
      const actions = document.createElement("div");
      actions.className = "conversation-actions";
      const open = document.createElement("button");
      open.type = "button"; open.textContent = "بازکردن";
      open.addEventListener("click", async () => {
        open.disabled = true;
        try {
          const result = await fetch("/api/conversations/" + encodeURIComponent(item.id), { credentials: "same-origin", cache: "no-store" });
          const detail = await result.json().catch(() => ({}));
          if (!result.ok || !detail.conversation) throw new Error(detail.message || "بارگذاری گفتگو انجام نشد.");
          panel.hidden = true;
          window.dispatchEvent(new CustomEvent("houshyar:load-conversation", { detail: detail.conversation }));
        } catch (error) { status.textContent = error.message; open.disabled = false; }
      });
      const rename = document.createElement("button");
      rename.type = "button"; rename.textContent = "تغییر عنوان";
      rename.addEventListener("click", async () => {
        const nextTitle = window.prompt("عنوان جدید گفتگو را وارد کنید:", item.title || "");
        if (nextTitle === null || !nextTitle.trim()) return;
        rename.disabled = true;
        try {
          const result = await fetch("/api/conversations/" + encodeURIComponent(item.id), {
            method: "PUT", credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: nextTitle.trim() })
          });
          const detail = await result.json().catch(() => ({}));
          if (!result.ok) throw new Error(detail.message || "تغییر عنوان انجام نشد.");
          await loadConversationHistory(content, status, panel);
        } catch (error) { status.textContent = error.message; rename.disabled = false; }
      });
      const remove = document.createElement("button");
      remove.type = "button"; remove.textContent = "حذف";
      remove.addEventListener("click", async () => {
        if (!window.confirm("این گفتگو برای همیشه حذف شود؟")) return;
        remove.disabled = true;
        try {
          const result = await fetch("/api/conversations/" + encodeURIComponent(item.id), { method: "DELETE", credentials: "same-origin" });
          const detail = await result.json().catch(() => ({}));
          if (!result.ok) throw new Error(detail.message || "حذف گفتگو انجام نشد.");
          window.dispatchEvent(new CustomEvent("houshyar:conversation-deleted", { detail: { id: item.id } }));
          await loadConversationHistory(content, status, panel);
        } catch (error) { status.textContent = error.message; remove.disabled = false; }
      });
      actions.append(open, rename, remove);
      row.append(info, actions);
      list.append(row);
    }
  } catch (error) {
    list.textContent = error.message || "تاریخچه در دسترس نیست.";
  }
}

export function initAccountPanel(app) {
  const button = app.querySelector("#account-open");
  if (!button || app.querySelector("#account-panel")) return;
  const panel = document.createElement("section");
  panel.id = "account-panel";
  panel.className = "account-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "پنل حساب کاربری");
  panel.innerHTML = `
    <div class="account-card">
      <div class="account-head"><strong>حساب کاربری</strong><button type="button" id="account-close" aria-label="بستن">✕</button></div>
      <p id="account-status" role="status">در حال بررسی وضعیت حساب…</p>
      <div id="account-content"></div>
    </div>`;
  app.append(panel);
  const content = panel.querySelector("#account-content");
  const status = panel.querySelector("#account-status");
  const close = () => { panel.hidden = true; };
  panel.querySelector("#account-close").addEventListener("click", close);
  button.addEventListener("click", async () => {
    panel.hidden = false;
    status.textContent = "در حال بررسی وضعیت حساب…";
    content.innerHTML = "";
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 503) {
        status.textContent = "حساب کاربری هنوز روی سرور فعال نشده است.";
        content.innerHTML = '<p class="account-muted">پس از راه‌اندازی امن پایگاه داده و سرویس حساب، امکان ورود و ثبت‌نام فعال می‌شود.</p>';
        return;
      }
      if (!response.ok) throw new Error("بررسی حساب انجام نشد.");
      if (data.authenticated) {
        status.textContent = "داشبورد حساب شما";
        const quota = data.quota?.enabled ? `
          <div class="quota-box">
            <b>سهمیه روزانه گفتگو</b>
            <strong>${safe(data.quota.remaining)} از ${safe(data.quota.limit)} درخواست باقی‌مانده</strong>
            <small>مصرف‌شده: ${safe(data.quota.used)} · بازنشانی: ${new Date(data.quota.resetAt * 1000).toLocaleString("fa-IR")}</small>
          </div>` : `
          <div class="dashboard-info">
            <b>سهمیه و مصرف</b>
            <p>نمایش آمار مصرف پس از فعال‌سازی سهمیه‌بندی سرور در دسترس خواهد بود.</p>
          </div>`;
        content.innerHTML = `
          <div class="dashboard-user">
            <span class="dashboard-avatar" aria-hidden="true">هـ</span>
            <div><strong>خوش آمدید</strong><p class="account-email"></p><small>حساب هوش‌یار</small></div>
          </div>
          <nav class="dashboard-tabs" aria-label="بخش‌های داشبورد">
            <button type="button" class="active" data-dashboard-tab="overview">نمای کلی</button>
            <button type="button" data-dashboard-tab="activity">گفتگوها و پروژه‌ها</button>
            <button type="button" data-dashboard-tab="plan">اشتراک و اعتبار</button>
            <button type="button" data-dashboard-tab="security">امنیت حساب</button>
          </nav>
          <section class="dashboard-view" data-dashboard-view="overview">
            ${quota}
            <div class="dashboard-section-head"><strong>شروع سریع</strong><small>یک کار را انتخاب کنید تا درخواست در کادر گفتگو آماده شود.</small></div>
            <div class="dashboard-shortcuts">
              <button type="button" data-dashboard-prompt="موضوع موردنظر من را دقیق بررسی کن و نتیجه را مرحله‌ای ارائه بده:">تحقیق و بررسی</button>
              <button type="button" data-dashboard-prompt="برای هدف من یک برنامه اجرایی با مراحل و زمان‌بندی بساز:">برنامه‌ریزی</button>
              <button type="button" data-dashboard-prompt="برای کسب‌وکار من چند راهکار عملی رشد و جذب مشتری پیشنهاد بده:">کسب‌وکار</button>
              <button type="button" data-dashboard-prompt="این متن را حرفه‌ای و روان بازنویسی کن:">تولید محتوا</button>
            </div>
            <div id="ads-panel-mount"></div>
            <div id="draw-admin-panel-mount"></div>
          </section>
          <section class="dashboard-view" data-dashboard-view="activity" hidden>
            <div class="dashboard-info"><b>تاریخچه گفتگوها</b><p>گفتگوهای ذخیره‌شده فقط برای حساب فعلی قابل مشاهده‌اند. امکان بازکردن، تغییر عنوان و حذف هر گفتگو وجود دارد.</p></div>
            <div class="history-toolbar"><button type="button" id="history-refresh">به‌روزرسانی فهرست</button><button type="button" id="history-new">شروع گفتگوی تازه</button></div>
            <div id="conversation-history" class="conversation-history" aria-live="polite">در حال دریافت تاریخچه…</div>
            <div class="dashboard-info"><b>پروژه‌های ذخیره‌شده</b><p>فضای مستقل پروژه‌ها و ذخیره فایل‌ها در مرحله بعدی توسعه قرار دارد.</p></div>
          </section>
          <section class="dashboard-view" data-dashboard-view="plan" hidden>
            <div class="dashboard-info"><b>طرح فعلی</b><p>وضعیت طرح اشتراکی هنوز به سامانه صورتحساب متصل نشده است؛ هیچ اشتراک پولی فعالی از این صفحه اعلام نمی‌شود.</p></div>
            <div class="dashboard-info"><b>اعتبار و پاداش تبلیغاتی</b><p>اعتبار قابل استفاده یا پاداش نقدی فقط پس از ثبت و تسویه واقعی نمایش داده می‌شود. این بخش فعلاً فعال نیست.</p></div>
            <div class="dashboard-info"><b>پرداخت</b><p>درگاه بانکی و پرداخت رمزارزی هنوز در محیط عملیاتی پیکربندی نشده‌اند.</p></div>
          </section>
          <section class="dashboard-view" data-dashboard-view="security" hidden>
            <div class="dashboard-info"><b>وضعیت ورود</b><p>شما با این حساب وارد شده‌اید. اطلاعات نشست از طریق کوکی امن سمت سرور مدیریت می‌شود.</p></div>
            <div class="dashboard-info"><b>توصیه امنیتی</b><p>رمز عبور منحصربه‌فرد و حداقل ۱۲ نویسه‌ای استفاده کنید و آن را در اختیار دیگران قرار ندهید.</p></div>
            <button type="button" id="account-logout" class="account-submit">خروج از حساب</button>
          </section>`;
        content.querySelector(".account-email").textContent = data.user?.email || "ایمیل ثبت‌شده";
        content.querySelectorAll("[data-dashboard-tab]").forEach(tab => tab.addEventListener("click", () => {
          content.querySelectorAll("[data-dashboard-tab]").forEach(item => item.classList.toggle("active", item === tab));
          content.querySelectorAll("[data-dashboard-view]").forEach(view => { view.hidden = view.dataset.dashboardView !== tab.dataset.dashboardTab; });
          if (tab.dataset.dashboardTab === "activity") loadConversationHistory(content, status, panel);
        }));
        content.querySelector("#history-refresh").addEventListener("click", () => loadConversationHistory(content, status, panel));
        content.querySelector("#history-new").addEventListener("click", () => {
          panel.hidden = true;
          window.dispatchEvent(new CustomEvent("houshyar:new-conversation"));
        });
        content.querySelectorAll("[data-dashboard-prompt]").forEach(item => item.addEventListener("click", () => {
          const prompt = app.querySelector("#prompt");
          if (!prompt) return;
          prompt.value = item.dataset.dashboardPrompt;
          prompt.dispatchEvent(new Event("input", { bubbles: true }));
          panel.hidden = true;
          prompt.focus();
        }));
        initAdsPanel(content.querySelector("#ads-panel-mount"), data.user);
        if (data.user?.role === "admin") initDrawAdminPanel(content.querySelector("#draw-admin-panel-mount"));
        content.querySelector("#account-logout").addEventListener("click", async () => {
          const logout = content.querySelector("#account-logout");
          logout.disabled = true;
          try {
            const out = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin" });
            if (!out.ok) throw new Error("خروج انجام نشد؛ دوباره تلاش کنید.");
            status.textContent = "از حساب خارج شدید.";
            content.innerHTML = "";
          } catch (error) {
            status.textContent = error.message;
            logout.disabled = false;
          }
        });
        return;
      }
      status.textContent = "برای استفاده از امکانات حساب وارد شوید.";
      content.innerHTML = `
        <div class="account-tabs"><button type="button" data-mode="login" class="active">ورود</button><button type="button" data-mode="register">ثبت‌نام</button></div>
        <form id="account-form">
          <label>ایمیل<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
          <label>رمز عبور<input name="password" type="password" autocomplete="current-password" minlength="12" maxlength="128" required></label>
          <button type="submit" class="account-submit">ورود</button>
        </form>
        <div class="account-actions"><button type="button" id="account-forgot">فراموشی رمز عبور</button><button type="button" id="account-resend">ارسال دوباره ایمیل تأیید</button></div><p class="account-muted">رمز عبور باید حداقل ۱۲ نویسه باشد. حساب جدید پس از تأیید ایمیل فعال می‌شود.</p>`;
      let mode = "login";
      content.querySelectorAll("[data-mode]").forEach(tab => tab.addEventListener("click", () => {
        mode = tab.dataset.mode;
        content.querySelectorAll("[data-mode]").forEach(x => x.classList.toggle("active", x === tab));
        const pass = content.querySelector('[name="password"]');
        pass.autocomplete = mode === "login" ? "current-password" : "new-password";
        content.querySelector(".account-submit").textContent = mode === "login" ? "ورود" : "ایجاد حساب";
      }));
      const emailInput = content.querySelector('[name="email"]');
      content.querySelector("#account-forgot")?.addEventListener("click", async () => {
        if (!emailInput.value.trim()) { status.textContent = "ابتدا ایمیل خود را وارد کنید."; emailInput.focus(); return; }
        status.textContent = "در حال ارسال درخواست بازیابی…";
        try {
          const r = await fetch("/api/auth/request-password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: emailInput.value }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.message || "درخواست بازیابی انجام نشد.");
          status.textContent = d.message || "اگر حساب فعالی با این ایمیل وجود داشته باشد، دستور بازیابی ارسال می‌شود.";
        } catch (error) { status.textContent = error.message; }
      });
      content.querySelector("#account-resend")?.addEventListener("click", async () => {
        if (!emailInput.value.trim()) { status.textContent = "ابتدا ایمیل خود را وارد کنید."; emailInput.focus(); return; }
        status.textContent = "در حال ارسال ایمیل تأیید…";
        try {
          const r = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: emailInput.value }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.message || "ارسال ایمیل انجام نشد.");
          status.textContent = d.message || "اگر حساب تأییدنشده‌ای با این ایمیل وجود داشته باشد، پیوند ارسال می‌شود.";
        } catch (error) { status.textContent = error.message; }
      });
      content.querySelector("#account-form").addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const submit = form.querySelector("button[type=submit]");
        submit.disabled = true;
        status.textContent = "در حال ارسال درخواست…";
        try {
          const response = await fetch("/api/auth/" + mode, {
            method: "POST", credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email.value, password: form.password.value })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.message || (result.error === "AUTH_NOT_CONFIGURED" ? "حساب کاربری هنوز فعال نشده است." : "ورود یا ثبت‌نام انجام نشد."));
          if (mode === "register") {
            status.textContent = "درخواست ثبت‌نام ثبت شد. صندوق ورودی و پوشه هرزنامه را برای تأیید ایمیل بررسی کنید.";
            return;
          }
          status.textContent = "ورود موفق بود.";
          button.click();
        } catch (error) { status.textContent = error.message; }
        finally { submit.disabled = false; form.password.value = ""; }
      });
    } catch (error) { status.textContent = error.message || "خطا در بررسی حساب."; }
  });
}
