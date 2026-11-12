const safe = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
export function initAccountPanel(app) {
  const button = app.querySelector("#account-open");
  if (!button || app.querySelector("#account-panel")) return;
  const panel = document.createElement("section");
  panel.id = "account-panel";
  panel.className = "account-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", t("accountPanelLabel",getLocale()));
  panel.innerHTML = `
    <div class="account-card">
      <div class="account-head"><strong>${t("accountPanelLabel",getLocale())}</strong><button type="button" id="account-close" aria-label=t("accountClose",getLocale())>✕</button></div>
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
    status.textContent = t("accountChecking",getLocale());
    content.innerHTML = "";
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 503) {
        status.textContent = t("accountNotReady",getLocale());
        content.innerHTML = '<p class="account-muted">پس از راه‌اندازی امن پایگاه داده و سرویس حساب، امکان ورود و ثبت‌نام فعال می‌شود.</p>';
        return;
      }
      if (!response.ok) throw new Error("بررسی حساب انجام نشد.");
      if (data.authenticated) {
        status.textContent = t("accountSignedIn",getLocale());
        const q = data.quota?.enabled ? `<div class="quota-box"><b>${t("quotaToday",getLocale())}</b><strong>${safe(data.quota.remaining)} از ${safe(data.quota.limit)}</strong><small>مصرف‌شده: ${safe(data.quota.used)} · بازنشانی: ${new Date(data.quota.resetAt * 1000).toLocaleString("fa-IR")}</small></div>` : '<p class="account-muted">${t("quotaNotEnabled",getLocale())}</p>';
        content.innerHTML = `<p class="account-email"></p>${q}<button type="button" id="account-logout" class="account-submit">${t("logout",getLocale())}</button>`;
        content.querySelector(".account-email").textContent = data.user.email;
        content.querySelector("#account-logout").addEventListener("click", async () => {
          const out = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin" });
          if (out.ok) { status.textContent = t("loggedOut",getLocale()); content.innerHTML = ""; }
          else status.textContent = t("logoutFailed",getLocale());
        });
        return;
      }
      status.textContent = t("accountSignInPrompt",getLocale());
      content.innerHTML = `
        <div class="account-tabs"><button type="button" data-mode="login" class="active">${t("login",getLocale())}</button><button type="button" data-mode="register">${t("register",getLocale())}</button></div>
        <form id="account-form">
          <label>${t("email",getLocale())}<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
          <label>${t("password",getLocale())}<input name="password" type="password" autocomplete="current-password" minlength="12" maxlength="128" required></label>
          <button type="submit" class="account-submit">ورود</button>
        </form>
        <div class="account-actions"><button type="button" id="account-forgot">${t("forgotPassword",getLocale())}</button><button type="button" id="account-resend">${t("resendVerification",getLocale())}</button></div><p class="account-muted">${t("passwordMinimum",getLocale())}</p>`;
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
        if (!emailInput.value.trim()) { status.textContent = t("enterEmail",getLocale()); emailInput.focus(); return; }
        status.textContent = t("sendingReset",getLocale());
        try {
          const r = await fetch("/api/auth/request-password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: emailInput.value }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.message || t("resetFailed",getLocale()));
          status.textContent = d.message || "اگر حساب فعالی با این ایمیل وجود داشته باشد، دستور بازیابی ارسال می‌شود.";
        } catch (error) { status.textContent = error.message; }
      });
      content.querySelector("#account-resend")?.addEventListener("click", async () => {
        if (!emailInput.value.trim()) { status.textContent = t("enterEmail",getLocale()); emailInput.focus(); return; }
        status.textContent = t("sendingVerification",getLocale());
        try {
          const r = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: emailInput.value }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.message || t("verificationFailed",getLocale()));
          status.textContent = d.message || "اگر حساب تأییدنشده‌ای با این ایمیل وجود داشته باشد، پیوند ارسال می‌شود.";
        } catch (error) { status.textContent = error.message; }
      });
      content.querySelector("#account-form").addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const submit = form.querySelector("button[type=submit]");
        submit.disabled = true;
        status.textContent = t("sendingRequest",getLocale());
        try {
          const response = await fetch("/api/auth/" + mode, {
            method: "POST", credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email.value, password: form.password.value })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.message || (result.error === "AUTH_NOT_CONFIGURED" ? "حساب کاربری هنوز فعال نشده است." : t("loginFailed",getLocale())));
          if (mode === "register") {
            status.textContent = "درخواست ثبت‌نام ثبت شد. صندوق ورودی و پوشه هرزنامه را برای تأیید ایمیل بررسی کنید.";
            return;
          }
          status.textContent = t("loginSuccess",getLocale());
          button.click();
        } catch (error) { status.textContent = error.message; }
        finally { submit.disabled = false; form.password.value = ""; }
      });
    } catch (error) { status.textContent = error.message || t("accountCheckFailed",getLocale()); }
  });
}
