import "./usage-dashboard.css";

const copy = {
  fa: { button:"گزارش مصرف هوش مصنوعی · ۳۰ روز", loading:"در حال دریافت گزارش…", unavailable:"گزارش مصرف در دسترس نیست. ورود و فعال بودن ثبت مصرف را بررسی کنید.", requests:"درخواست‌ها", tokens:"توکن مصرف‌شده", cost:"هزینه تخمینی", unknown:"درخواست بدون نرخ هزینه", providers:"مصرف بر اساس ارائه‌دهنده", recent:"آخرین درخواست‌ها", search:"جستجوی وب", yes:"بله", no:"خیر", noData:"هنوز داده‌ای برای این بازه ثبت نشده است.", period:"۳۰ روز گذشته", usd:"دلار آمریکا", model:"مدل", date:"زمان" },
  en: { button:"AI usage report · 30 days", loading:"Loading usage report…", unavailable:"Usage report is unavailable. Check sign-in and usage metering configuration.", requests:"Requests", tokens:"Tokens used", cost:"Estimated cost", unknown:"Requests without a cost rate", providers:"Usage by provider", recent:"Recent requests", search:"Web search", yes:"Yes", no:"No", noData:"No usage recorded for this period.", period:"Last 30 days", usd:"USD", model:"Model", date:"Date" },
  de: { button:"KI-Verbrauch · 30 Tage", loading:"Bericht wird geladen…", unavailable:"Bericht nicht verfügbar. Anmeldung und Verbrauchserfassung prüfen.", requests:"Anfragen", tokens:"Verbrauchte Tokens", cost:"Geschätzte Kosten", unknown:"Anfragen ohne Kostenrate", providers:"Verbrauch nach Anbieter", recent:"Letzte Anfragen", search:"Websuche", yes:"Ja", no:"Nein", noData:"Keine Nutzung in diesem Zeitraum.", period:"Letzte 30 Tage", usd:"USD", model:"Modell", date:"Zeit" }
};
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const number = (value, locale) => new Intl.NumberFormat(locale).format(Number(value) || 0);
const money = (micro, locale) => new Intl.NumberFormat(locale, { style:"currency", currency:"USD", maximumFractionDigits:6 }).format((Number(micro) || 0) / 1_000_000);

export function initUsageDashboard(container, locale = "en") {
  if (!container || container.querySelector("[data-usage-dashboard]")) return;
  const labels = copy[locale] || copy.en;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "account-usage-open";
  button.textContent = labels.button;
  button.setAttribute("aria-expanded", "false");
  const panel = document.createElement("section");
  panel.className = "usage-dashboard";
  panel.hidden = true;
  panel.setAttribute("data-usage-dashboard", "");
  panel.setAttribute("aria-live", "polite");
  container.append(button, panel);

  button.addEventListener("click", async () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
    if (!opening || panel.dataset.loaded === "true") return;
    panel.textContent = labels.loading;
    try {
      const response = await fetch("/api/billing/usage?days=30", { credentials:"same-origin", cache:"no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "USAGE_REPORT_UNAVAILABLE");
      const s = data.summary || {};
      const providers = Array.isArray(data.providers) ? data.providers : [];
      const recent = Array.isArray(data.recent) ? data.recent : [];
      const providerRows = providers.map(item => `<li><span>${escape(item.provider_code)}</span><b>${number(item.request_count, locale)} · ${money(item.estimated_cost_micro_usd, locale)}</b></li>`).join("");
      const recentRows = recent.slice(0, 12).map(item => {
        const date = Number(item.created_at) > 0 ? new Intl.DateTimeFormat(locale, { dateStyle:"short", timeStyle:"short" }).format(new Date(Number(item.created_at) * 1000)) : "—";
        const cost = item.estimated_cost_micro_usd == null ? "—" : money(item.estimated_cost_micro_usd, locale);
        return `<li><div><b>${escape(item.provider_code)} · ${escape(item.model_code)}</b><small>${escape(date)} · ${labels.search}: ${item.web_search_used ? labels.yes : labels.no}</small></div><span>${number(item.total_tokens, locale)} · ${cost}</span></li>`;
      }).join("");
      panel.innerHTML = `
        <p class="usage-period">${labels.period}</p>
        <div class="usage-metrics">
          <div><small>${labels.requests}</small><strong>${number(s.requests, locale)}</strong></div>
          <div><small>${labels.tokens}</small><strong>${number(s.totalTokens, locale)}</strong></div>
          <div><small>${labels.cost}</small><strong>${money(s.estimatedCostMicroUsd, locale)}</strong></div>
        </div>
        ${Number(s.unpricedRequests) > 0 ? `<p class="usage-warning">${number(s.unpricedRequests, locale)} ${labels.unknown}; هزینه واقعی ممکن است بیشتر یا کمتر باشد.</p>` : ""}
        <h4>${labels.providers}</h4><ul class="usage-list">${providerRows || `<li>${labels.noData}</li>`}</ul>
        <h4>${labels.recent}</h4><ul class="usage-list usage-recent">${recentRows || `<li>${labels.noData}</li>`}</ul>`;
      panel.dataset.loaded = "true";
    } catch {
      panel.textContent = labels.unavailable;
    }
  });
}
