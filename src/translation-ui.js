import { buildTranslationRequest, protectNumericTokens, restoreNumericTokens, SUPPORTED_TRANSLATION_LANGUAGES } from "./translation-core.js";

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

export function initTranslationUI(app) {
  const toolbox = app.querySelector(".toolbox");
  if (!toolbox || app.querySelector("#translation-panel")) return;
  const options = SUPPORTED_TRANSLATION_LANGUAGES.map(language => '<option value="' + escapeHTML(language) + '">' + escapeHTML(language) + '</option>').join("");
  const panel = document.createElement("section");
  panel.id = "translation-panel";
  panel.className = "translation-panel";
  panel.innerHTML = '<div class="translation-heading"><div><span class="translation-eyebrow">HOUSHYAR TRANSLATOR</span><h2 id="translation-title">مترجم هوش‌یار</h2></div><span class="translation-count">۱۰۰ زبان</span></div>' +
    '<p class="translation-description">ترجمه متن با موتور هوش مصنوعی انتخاب‌شده در نوار گفتگو.</p>' +
    '<form id="translation-form"><div class="translation-fields">' +
    '<label>زبان مبدأ<select id="translation-source"><option value="auto">تشخیص خودکار</option>' + options + '</select></label>' +
    '<label>زبان مقصد<select id="translation-target" required><option value="">انتخاب زبان مقصد</option>' + options + '</select></label>' +
    '<label>سبک ترجمه<select id="translation-tone"><option value="natural">طبیعی و روان</option><option value="formal">رسمی</option><option value="casual">محاوره‌ای</option><option value="literal">تحت‌اللفظی</option></select></label></div>' +
    '<label class="translation-input-label" for="translation-input">متن برای ترجمه</label><textarea id="translation-input" maxlength="4500" rows="5" placeholder="متن خود را اینجا وارد کنید..." required></textarea>' +
    '<div class="translation-actions"><small id="translation-counter">۰ / ۴۵۰۰</small><button id="translation-submit" type="submit">ترجمه کن</button></div></form>' +
    '<p id="translation-status" class="translation-status" role="status" aria-live="polite"></p>' +
    '<section id="translation-result-wrap" class="translation-result-wrap" hidden><div class="translation-result-head"><strong>نتیجه ترجمه</strong><button type="button" id="translation-copy">کپی ترجمه</button></div><p id="translation-result" class="translation-result" dir="auto"></p></section>';
  toolbox.insertAdjacentElement("afterend", panel);

  const form = panel.querySelector("#translation-form");
  const input = panel.querySelector("#translation-input");
  const status = panel.querySelector("#translation-status");
  const output = panel.querySelector("#translation-result");
  const resultWrap = panel.querySelector("#translation-result-wrap");
  input.addEventListener("input", () => {
    panel.querySelector("#translation-counter").textContent = input.value.length.toLocaleString("fa-IR") + " / ۴۵۰۰";
  });
  panel.querySelector("#translation-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(output.textContent); status.textContent = "ترجمه کپی شد."; }
    catch { status.textContent = "کپی خودکار ممکن نیست؛ متن نتیجه را دستی کپی کنید."; }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = panel.querySelector("#translation-submit");
    let message;
    let numericTokens = [];
    try {
      const protectedInput = protectNumericTokens(input.value);
      numericTokens = protectedInput.tokens;
      message = buildTranslationRequest({
        text: protectedInput.text,
        sourceLanguage: panel.querySelector("#translation-source").value,
        targetLanguage: panel.querySelector("#translation-target").value,
        tone: panel.querySelector("#translation-tone").value
      });
    } catch (error) { status.textContent = error.message || "ورودی ترجمه معتبر نیست."; return; }

    button.disabled = true;
    button.textContent = "در حال ترجمه…";
    status.textContent = "درخواست در حال پردازش است…";
    resultWrap.hidden = true;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: [], mode: "balanced", provider: app.querySelector("#ai-provider")?.value || "auto" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "سرویس ترجمه در دسترس نیست.");
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("پاسخ ترجمه خالی بود.");
      output.textContent = restoreNumericTokens(data.reply.trim(), numericTokens);
      resultWrap.hidden = false;
      status.textContent = "ترجمه دریافت شد؛ موتور: " + (data.provider || "انتخاب خودکار");
    } catch (error) { status.textContent = error.message || "ارتباط با سرویس ترجمه ناموفق بود."; }
    finally { button.disabled = false; button.textContent = "ترجمه کن"; }
  });
}
