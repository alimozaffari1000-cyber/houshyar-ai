import { analyzeHTML, SEO_AUDIT_MAX_HTML_LENGTH } from "./seo-audit.js";
import "./seo-audit.css";

let overlay = null;
let activeLocale = "fa";
const labels = {
  fa: {button:"ممیزی سئو",title:"ممیزی اولیه سئو",desc:"کد HTML صفحه‌ای را که مالک آن هستید وارد کنید. تحلیل در مرورگر انجام می‌شود و هیچ درخواستی به سایت ارسال نمی‌شود.",placeholder:"کد HTML صفحه را اینجا وارد کنید…",run:"تحلیل HTML",close:"بستن",critical:"بحرانی",warning:"نیازمند بررسی",info:"اطلاعات",empty:"ابتدا کد HTML صفحه را وارد کنید.",size:"حجم ورودی از حد مجاز بیشتر است.",metrics:"شاخص‌های استخراج‌شده",limitations:"محدودیت‌های گزارش",done:"گزارش اولیه آماده شد",file:"انتخاب فایل HTML",export:"دریافت گزارش JSON",fileError:"فایل معتبر HTML با حجم مجاز انتخاب کنید."},
  en: {button:"SEO Audit",title:"Basic SEO audit",desc:"Paste HTML for a site you own. Analysis runs locally; no request is sent to the website.",placeholder:"Paste page HTML here…",run:"Analyze HTML",close:"Close",critical:"Critical",warning:"Review",info:"Info",empty:"Paste the page HTML first.",size:"Input exceeds the allowed size.",metrics:"Extracted metrics",limitations:"Report limitations",done:"Initial report is ready",file:"Choose HTML file",export:"Download JSON report",fileError:"Choose a valid HTML file within the size limit."}
};

function createOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement("section");
  overlay.className = "seo-audit-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role","dialog");
  overlay.setAttribute("aria-modal","true");
  overlay.setAttribute("aria-labelledby","seo-audit-title");
  document.body.append(overlay);
  overlay.addEventListener("click", event => { if (event.target === overlay) closeOverlay(); });
  overlay.addEventListener("keydown", event => { if (event.key === "Escape") closeOverlay(); });
  return overlay;
}

function closeOverlay() {
  if (!overlay) return;
  overlay.hidden = true;
  document.body.classList.remove("seo-audit-open");
  document.querySelector("[data-open-seo-audit]")?.focus();
}

function renderOverlay() {
  const t = labels[activeLocale];
  const current = createOverlay();
  current.innerHTML = '<div class="seo-audit-panel"><header><div><h2 id="seo-audit-title">' + t.title + '</h2><p>' + t.desc + '</p></div><button type="button" data-seo-close aria-label="' + t.close + '">×</button></header><form data-seo-form><label class="seo-audit-input-label" for="seo-html-input">' + t.placeholder + '</label><textarea id="seo-html-input" maxlength="' + SEO_AUDIT_MAX_HTML_LENGTH + '" spellcheck="false" dir="auto"></textarea><div class="seo-audit-file-row"><label for="seo-html-file">' + t.file + '</label><input id="seo-html-file" type="file" accept=".html,.htm,text/html"></div><div class="seo-audit-actions"><small data-seo-size>0 / ' + SEO_AUDIT_MAX_HTML_LENGTH.toLocaleString() + '</small><button type="submit">' + t.run + '</button></div></form><button type="button" data-seo-export hidden>' + t.export + '</button><div data-seo-report aria-live="polite"></div></div>';
  const input = current.querySelector("#seo-html-input");
  const report = current.querySelector("[data-seo-report]");
  const exportButton = current.querySelector("[data-seo-export]");
  let lastResult = null;
  current.querySelector("[data-seo-close]").addEventListener("click", closeOverlay);
  input.addEventListener("input", () => {
    current.querySelector("[data-seo-size]").textContent = input.value.length.toLocaleString() + " / " + SEO_AUDIT_MAX_HTML_LENGTH.toLocaleString();
    exportButton.hidden = true; lastResult = null;
  });
  current.querySelector("#seo-html-file").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > SEO_AUDIT_MAX_HTML_LENGTH || !(/\.html?$/i.test(file.name) || file.type === "text/html")) {
      report.textContent = t.fileError; event.target.value = ""; return;
    }
    try {
      const value = await file.text();
      if (value.length > SEO_AUDIT_MAX_HTML_LENGTH) throw new Error("HTML_TOO_LARGE");
      input.value = value;
      current.querySelector("[data-seo-size]").textContent = value.length.toLocaleString() + " / " + SEO_AUDIT_MAX_HTML_LENGTH.toLocaleString();
      report.replaceChildren(); exportButton.hidden = true; lastResult = null;
    } catch { report.textContent = t.fileError; }
  });
  current.querySelector("[data-seo-form]").addEventListener("submit", event => {
    event.preventDefault();
    report.replaceChildren(); exportButton.hidden = true; lastResult = null;
    try {
      const result = analyzeHTML(input.value);
      lastResult = { schemaVersion:1, generatedAt:new Date().toISOString(), report:result };
      const summary = document.createElement("div");
      summary.className = "seo-audit-summary";
      summary.textContent = t.done + " · " + t.critical + ": " + result.counts.critical + " · " + t.warning + ": " + result.counts.warning + " · " + t.info + ": " + result.counts.info;
      report.append(summary);
      const list = document.createElement("div");
      list.className = "seo-audit-findings";
      for (const item of result.findings) {
        const card = document.createElement("article");
        card.className = "seo-audit-finding severity-" + item.severity;
        const heading = document.createElement("h3"); heading.textContent = item.title;
        const evidence = document.createElement("p"); evidence.textContent = item.evidence;
        const recommendation = document.createElement("p"); recommendation.textContent = item.recommendation;
        card.append(heading,evidence,recommendation); list.append(card);
      }
      report.append(list);
      const metrics = document.createElement("p");
      metrics.className = "seo-audit-metrics";
      metrics.textContent = t.metrics + ": H1=" + result.metrics.h1Count + " · Images=" + result.metrics.imageCount + " · Missing alt=" + result.metrics.imagesMissingAlt + " · Links=" + result.metrics.linkCount;
      report.append(metrics);
      const limitations = document.createElement("ul");
      limitations.className = "seo-audit-limitations";
      for (const note of result.limitations) { const li = document.createElement("li"); li.textContent = note; limitations.append(li); }
      report.append(limitations);
      exportButton.hidden = false;
    } catch (error) {
      const message = document.createElement("p");
      message.className = "seo-audit-error";
      message.textContent = error.message === "HTML_TOO_LARGE" ? t.size : t.empty;
      report.append(message);
    }
  });
  exportButton.addEventListener("click", () => {
    if (!lastResult) return;
    const blob = new Blob([JSON.stringify(lastResult,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "houshyar-seo-audit.json";
    document.body.append(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  });
}

export function initSeoAudit(root = document, locale = "fa") {
  const toolbox = root.querySelector(".toolbox-grid");
  if (!toolbox) return;
  activeLocale = String(locale).toLowerCase().startsWith("fa") ? "fa" : "en";
  let trigger = toolbox.querySelector("[data-open-seo-audit]");
  if (!trigger) {
    trigger = document.createElement("button");
    trigger.type = "button";
    trigger.dataset.openSeoAudit = "";
    toolbox.append(trigger);
  }
  trigger.innerHTML = "<span>⌕</span><b>" + labels[activeLocale].button + "</b>";
  trigger.addEventListener("click", () => {
    renderOverlay();
    overlay.hidden = false;
    document.body.classList.add("seo-audit-open");
    overlay.querySelector("#seo-html-input").focus();
  }, {once:true});
}
