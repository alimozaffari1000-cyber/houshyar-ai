export function initAuthFlows(app) {
  if (app.querySelector("#auth-flow-overlay")) return;
  const params = new URLSearchParams(window.location.search);
  const verifyToken = params.get("verify_email");
  const resetToken = params.get("reset_password");
  if (!verifyToken && !resetToken) return;
  const token = verifyToken || resetToken;
  const mode = verifyToken ? "verify" : "reset";
  const overlay = document.createElement("section");
  overlay.id = "auth-flow-overlay";
  overlay.className = "account-panel auth-flow-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = '<div class="account-card"><div class="account-head"><strong>' + (mode === "verify" ? "تأیید ایمیل" : "تعیین رمز عبور جدید") + '</strong></div><p id="auth-flow-status" role="status"></p><div id="auth-flow-content"></div></div>';
  app.append(overlay);
  const status = overlay.querySelector("#auth-flow-status");
  const content = overlay.querySelector("#auth-flow-content");
  status.textContent = mode === "verify" ? "برای فعال‌سازی حساب، دکمه زیر را بزنید." : "رمز عبور جدیدی با حداقل ۱۲ نویسه انتخاب کنید.";
  const cleanUrl = () => {
    const clean = new URL(window.location.href);
    clean.searchParams.delete("verify_email");
    clean.searchParams.delete("reset_password");
    window.history.replaceState({}, "", clean.pathname + clean.search + clean.hash);
  };
  if (mode === "verify") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "account-submit";
    button.textContent = "تأیید ایمیل";
    content.append(button);
    button.addEventListener("click", async () => {
      button.disabled = true;
      status.textContent = "در حال بررسی پیوند…";
      try {
        const response = await fetch("/api/auth/verify-email", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "تأیید ایمیل انجام نشد؛ ممکن است پیوند منقضی شده باشد.");
        cleanUrl();
        status.textContent = "ایمیل با موفقیت تأیید شد. اکنون می‌توانید وارد حساب شوید.";
        button.remove();
      } catch (error) { status.textContent = error.message; button.disabled = false; }
    });
  } else {
    const form = document.createElement("form");
    form.innerHTML = '<label>رمز عبور جدید<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><button type="submit" class="account-submit">ذخیره رمز عبور</button>';
    content.append(form);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector("button");
      submit.disabled = true;
      status.textContent = "در حال تغییر رمز عبور…";
      try {
        const response = await fetch("/api/auth/reset-password", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: form.password.value }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "تغییر رمز عبور انجام نشد؛ ممکن است پیوند منقضی شده باشد.");
        cleanUrl();
        form.remove();
        status.textContent = "رمز عبور تغییر کرد و نشست‌های قبلی بسته شدند. اکنون می‌توانید وارد شوید.";
      } catch (error) { status.textContent = error.message; submit.disabled = false; }
    });
  }
}
