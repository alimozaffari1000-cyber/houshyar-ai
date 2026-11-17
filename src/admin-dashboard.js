const labels = {
  fa: { button: "سلامت سامانه", title: "داشبورد سلامت هوش‌یار", loading: "در حال دریافت وضعیت…", close: "بستن", retry: "تلاش دوباره", ready: "آماده", degraded: "نیازمند بررسی", unavailable: "گزارش سلامت در دسترس نیست", auth: "نشست مدیریتی معتبر نیست." },
  en: { button: "System health", title: "Houshyar health dashboard", loading: "Loading status…", close: "Close", retry: "Retry", ready: "Ready", degraded: "Needs attention", unavailable: "Health report unavailable", auth: "Admin session is not valid." }
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
  const heading = make("h3", "", report.status === "ready" ? copy.ready : copy.degraded);
  container.append(heading);
  const checks = report.checks && typeof report.checks === "object" ? report.checks : {};
  for (const [name, value] of Object.entries(checks)) {
    const row = make("div", "admin-health-check");
    row.append(make("span", "", name.replaceAll("_", " ")));
    row.append(make("strong", value === true ? "is-ok" : "is-warning", value === true ? copy.ready : copy.degraded));
    container.append(row);
  }
  container.append(make("small", "admin-health-time", new Date(report.timestamp || Date.now()).toLocaleString()));
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
