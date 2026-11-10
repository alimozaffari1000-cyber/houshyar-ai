const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const formatDate = value => {
  if (!value) return "اعلام نشده";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "اعلام نشده" : date.toLocaleString("fa-IR");
};

export function initDrawPanel(app) {
  const anchor = app.querySelector("#draw-panel-mount");
  if (!anchor || anchor.dataset.initialized) return;
  anchor.dataset.initialized = "true";
  const root = document.createElement("section");
  root.className = "draw-panel";
  root.innerHTML = `
    <div class="draw-panel-head"><div><span class="draw-eyebrow">HOUSHYAR DRAWS</span><h2>قرعه‌کشی‌های هوش‌یار</h2><p>شرکت در دوره‌های رایگان؛ بدون خرید بلیت و بدون پرداخت پول.</p></div><button type="button" id="draw-refresh">بروزرسانی</button></div>
    <div id="draw-status" class="draw-muted" role="status">در حال دریافت دوره‌ها…</div>
    <div id="draw-list" class="draw-list"></div>`;
  anchor.append(root);
  const status = root.querySelector("#draw-status");
  const list = root.querySelector("#draw-list");
  async function request(url, options) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messages = {
        DRAWS_NOT_CONFIGURED: "ماژول قرعه‌کشی هنوز روی سرور فعال نشده است.",
        AUTH_REQUIRED: "برای شرکت در قرعه‌کشی ابتدا وارد حساب کاربری شوید.",
        DRAW_NOT_OPEN: "ثبت‌نام این دوره باز نیست.",
        DRAW_ENTRY_UNAVAILABLE: "ظرفیت دوره تکمیل شده یا مهلت ثبت‌نام پایان یافته است."
      };
      throw new Error(messages[data.error] || data.message || "درخواست قرعه‌کشی انجام نشد.");
    }
    return data;
  }
  async function refresh() {
    status.textContent = "در حال دریافت دوره‌ها…";
    list.innerHTML = "";
    try {
      const data = await request("/api/draws/campaigns");
      if (!data.campaigns?.length) {
        status.textContent = "در حال حاضر دوره عمومی فعالی برای نمایش وجود ندارد.";
        return;
      }
      status.textContent = "تعداد شرکت‌کنندگان و بلیت‌های واجد شرایط از داده‌های سرور خوانده می‌شود.";
      list.innerHTML = data.campaigns.map(item => `
        <article class="draw-card">
          <div class="draw-card-top"><b>${safe(item.title)}</b><span class="draw-state">${safe(item.status)}</span></div>
          <p>${safe(item.description || "")}</p>
          <div class="draw-prize"><small>جایزه</small><strong>${safe(item.prize_description)}</strong></div>
          <div class="draw-stats">
            <div><small>شرکت‌کنندگان</small><b>${Number(item.participants || 0).toLocaleString("fa-IR")}</b></div>
            <div><small>بلیت‌های معتبر</small><b>${Number(item.eligible_entries || 0).toLocaleString("fa-IR")}</b></div>
            <div><small>ظرفیت</small><b>${Number(item.max_entries || 0).toLocaleString("fa-IR")}</b></div>
          </div>
          <p class="draw-dates">پایان ثبت‌نام: ${formatDate(item.ends_at)} · زمان قرعه‌کشی: ${formatDate(item.draw_at)}</p>
          ${item.status === "open" ? '<button type="button" class="draw-enter" data-enter="' + safe(item.id) + '">ثبت‌نام رایگان و دریافت بلیت</button>' : ""}
          ${item.status === "drawn" ? '<button type="button" class="draw-result" data-result="' + safe(item.id) + '">مشاهده نتیجه</button>' : ""}
        </article>`).join("");
    } catch (error) {
      status.textContent = error.message || "قرعه‌کشی فعلاً در دسترس نیست.";
    }
  }
  root.querySelector("#draw-refresh").addEventListener("click", refresh);
  root.addEventListener("click", async event => {
    const enter = event.target.closest("[data-enter]");
    const resultButton = event.target.closest("[data-result]");
    if (enter) {
      enter.disabled = true;
      try {
        const data = await request("/api/draws/entries", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId: enter.dataset.enter })
        });
        status.textContent = data.duplicate
          ? "قبلاً در این دوره ثبت‌نام کرده‌اید. کد بلیت: " + data.entry.ticketCode
          : "ثبت‌نام انجام شد. کد بلیت شما: " + data.entry.ticketCode;
        await refresh();
      } catch (error) {
        status.textContent = error.message;
        enter.disabled = false;
      }
    }
    if (resultButton) {
      resultButton.disabled = true;
      try {
        const data = await request("/api/draws/results?campaignId=" + encodeURIComponent(resultButton.dataset.result));
        const result = data.result;
        status.textContent = result.status === "verified"
          ? "نتیجه تأیید شده است. کد بلیت برنده: " + result.winningTicketCode
          : "قرعه‌کشی انجام شده، اما نتیجه هنوز در انتظار راستی‌آزمایی است.";
      } catch (error) { status.textContent = error.message; }
      finally { resultButton.disabled = false; }
    }
  });
  refresh();
}
