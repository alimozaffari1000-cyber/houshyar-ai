const labels = {
  fa: { button: "سلامت سامانه", title: "داشبورد سلامت هوش‌یار", loading: "در حال دریافت وضعیت…", close: "بستن", retry: "تلاش دوباره", ready: "آماده", configured: "فعال", notConfigured: "تنظیم نشده", degraded: "نیازمند بررسی", unavailable: "گزارش سلامت در دسترس نیست", auth: "نشست مدیریتی معتبر نیست.", metrics: "عملکرد ۲۴ ساعت اخیر", requests: "درخواست‌ها", failures: "خطاها", latency: "میانگین تأخیر", successRate: "موفقیت", failureRate: "نرخ خطا", maxLatency: "بیشترین تأخیر", metricsDisabled: "ثبت شاخص‌ها هنوز فعال نشده است.", metricsUnavailable: "شاخص‌ها فعلاً در دسترس نیستند." },
  en: { button: "System health", title: "Houshyar health dashboard", loading: "Loading status…", close: "Close", retry: "Retry", ready: "Ready", configured: "Configured", notConfigured: "Not configured", degraded: "Needs attention", unavailable: "Health report unavailable", auth: "Admin session is not valid.", metrics: "Last 24 hours", requests: "Requests", failures: "Failures", latency: "Average latency", successRate: "Success rate", failureRate: "Failure rate", maxLatency: "Max latency", metricsDisabled: "Metrics collection is not enabled.", metricsUnavailable: "Metrics are currently unavailable." }
};
const getLabels = () => labels[document.documentElement.lang] || labels.fa;
const make = (tag, className, value) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
};
async function fetchHealth() {
  const response = await fetch("/api/admin/health", { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "HEALTH_UNAVAILABLE");
  return data;
}
function renderChecks(container, report, copy) {
  container.replaceChildren();
  container.append(make("h3", "", report.status === "ready" ? copy.ready : copy.degraded));
  const checks = report.checks && typeof report.checks === "object" ? report.checks : {};
  const rows = [];
  for (const [name, value] of Object.entries(checks)) {
    if (!value || typeof value !== "object") continue;
    const status = typeof value.status === "string" ? value.status : (value.ready === true ? "ready" : "unavailable");
    rows.push([name, status]);
    if (value.providers && typeof value.providers === "object") {
      for (const [provider, enabled] of Object.entries(value.providers)) {
        rows.push([name + " / " + provider, enabled === true ? "configured" : "not_configured"]);
      }
    }
  }
  for (const [name, status] of rows) {
    const ok = ["ready", "configured"].includes(status);
    const row = make("div", "admin-health-check");
    row.append(make("span", "", name.replaceAll("_", " ")));
    const label = status === "ready" ? copy.ready : status === "configured" ? copy.configured : status === "not_configured" ? copy.notConfigured : copy.degraded;
    row.append(make("strong", ok ? "is-ok" : "is-warning", label));
    container.append(row);
  }
  container.append(make("small", "admin-health-time", new Date(report.timestamp || Date.now()).toLocaleString()));
}
async function fetchMetrics() {
  const response = await fetch("/api/admin/metrics", { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 503) throw new Error(data.error || "METRICS_UNAVAILABLE");
  return data;
}
function renderMetrics(container, report, copy) {
  container.append(make("h3", "admin-metrics-title", copy.metrics));
  if (report.status === "disabled") {
    container.append(make("p", "admin-metrics-note", copy.metricsDisabled));
    return;
  }
  if (report.status !== "ready") {
    container.append(make("p", "admin-metrics-note", copy.metricsUnavailable));
    return;
  }
  const totals = report.totals || {};
  const summary = make("div", "admin-metrics-summary");
  summary.append(make("span", "", copy.requests + ": " + (Number(totals.requests) || 0)));
  summary.append(make("span", "", copy.failures + ": " + (Number(totals.failures) || 0)));
  container.append(summary);
  for (const item of Array.isArray(report.providers) ? report.providers : []) {
    const row = make("div", "admin-health-check");
    row.append(make("span", "", String(item.provider || "unknown")));
    const failures = Number(item.failures) || 0;
    const isFailure = String(item.event || "").includes("failure") || failures > 0;
    row.append(make("strong", isFailure ? "is-warning" : "is-ok",
      copy.requests + ": " + (Number(item.requests) || 0) +
      " · " + copy.failures + ": " + failures +
      " · " + copy.successRate + ": " + (Number(item.requests) > 0 ? Math.round((Number(item.successes) || 0) / Number(item.requests) * 1000) / 10 : 0) + "%" +
      " · " + copy.failureRate + ": " + (Number(item.failureRatePercent) || 0) + "%" +
      " · " + copy.latency + ": " + (Number(item.avgLatencyMs) || 0) + " ms" +
      " · " + copy.maxLatency + ": " + (Number(item.maxLatencyMs) || 0) + " ms"));
    container.append(row);
  }
}
function openPanel() {
  const copy = getLabels();
  const overlay = make("div", "admin-health-overlay");
  overlay.setAttribute("role", "presentation");
  const dialog = make("section", "admin-health-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", copy.title);
  const header = make("header", "admin-health-header");
  header.append(make("h2", "", copy.title));
  const close = make("button", "admin-health-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", copy.close);
  const content = make("div", "admin-health-content", copy.loading);
  const retry = make("button", "admin-health-retry", copy.retry);
  retry.type = "button";
  const load = async () => {
    content.textContent = copy.loading;
    try {
      const report = await fetchHealth();
      renderChecks(content, report, copy);
      try { renderMetrics(content, await fetchMetrics(), copy); } catch { renderMetrics(content, { status: "unavailable" }, copy); }
    } catch {
      content.textContent = copy.unavailable;
    }
  };
  close.addEventListener("click", () => overlay.remove());
  retry.addEventListener("click", load);
  overlay.addEventListener("click", event => { if (event.target === overlay) overlay.remove(); });
  dialog.append(header, content, retry);
  header.append(close);
  overlay.append(dialog);
  document.body.append(overlay);
  load();
}
export function initAdminDashboard(app) {
  const actions = app.querySelector(".top-actions");
  if (!actions || actions.dataset.adminCheck === "done") return;
  actions.dataset.adminCheck = "done";
  fetch("/api/auth/me", { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" })
    .then(response => response.ok ? response.json() : null)
    .then(data => {
      if (!data?.authenticated || data.user?.role !== "admin" || !actions.isConnected) return;
      const button = make("button", "account-open admin-health-open", getLabels().button);
      button.type = "button";
      button.addEventListener("click", openPanel);
      actions.append(button);
    })
    .catch(() => {});
}
