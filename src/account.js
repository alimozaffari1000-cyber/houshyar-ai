import { initAdsPanel } from "./ads-panel.js";
import { initDrawAdminPanel } from "./draw-admin-panel.js";

const safe = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
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
        status.textContent = "وارد حساب شده‌اید.";
        const q = data.quota?.enabled ? `<div class="quota-box"><b>سهمیه امروز</b><strong>${safe(data.quota.remaining)} از ${safe(data.quota.limit)}</strong><small>مصرف‌شده: ${safe(data.quota.used)} · بازنشانی: ${new Date(data.quota.resetAt * 1000).toLocaleString("fa-IR")}</small></div>` : '<p class="account-muted">نمایش سهمیه هنوز فعال نشده است.</p>';
        content.innerHTML = `<p class="account-email"></p>${q}<div id="ads-panel-mount"></div><div id="draw-admin-panel-mount"></div><button type="button" id="account-logout" class="account-submit">خروج از حساب</button>`;
        content.querySelector(".account-email").textContent = data.user.email;
        initAdsPanel(content.querySelector("#ads-panel-mount"), data.user);
        if (data.user.role === "admin") initDrawAdminPanel(content.querySelector("#draw-admin-panel-mount"));
        content.querySelector("#account-logout").addEventListener("click", async () => {
          const out = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin" });
          if (out.ok) { status.textContent = "از حساب خارج شدید."; content.innerHTML = ""; }
          else status.textContent = "خروج انجام نشد؛ دوباره تلاش کنید.";
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
