import { TRANSLATION_LANGUAGES, getTranslationLanguageName } from "./translation-languages.js";
const COPY = {
  fa: { title:"مترجم هوشمند", subtitle:"از میان ۱۰۰ زبان، زبان مبدأ و مقصد را انتخاب کن.", source:"زبان مبدأ", target:"زبان مقصد", text:"متن برای ترجمه", placeholder:"متن را اینجا وارد کن…", translate:"ترجمه با هوش‌یار", close:"بستن" },
  en: { title:"AI Translator", subtitle:"Choose a source and target from 100 languages.", source:"Source language", target:"Target language", text:"Text to translate", placeholder:"Enter text here…", translate:"Translate with Houshyar", close:"Close" }
};
export function buildTranslationPrompt({ source = "", target, text }) {
  const sourceLanguage = String(source).trim().slice(0, 80);
  const targetLanguage = String(target || "").trim().slice(0, 80);
  const content = String(text || "").trim().slice(0, 5000);
  if (!targetLanguage || !content) throw new TypeError("TARGET_AND_TEXT_REQUIRED");
  return ["Act as a professional multilingual translator.", "Translate the source text into the requested target language.", "Preserve meaning, tone, names, numbers, formatting and paragraph structure.", "Do not summarize, explain or add facts. If a phrase is ambiguous, preserve the ambiguity.", "Return only the translation unless a critical clarification is necessary.", "Source language: " + (sourceLanguage || "Automatically detect"), "Target language: " + targetLanguage, "Text to translate:", content].join("\n\n");
}
export function initTranslator(app, { locale = "fa" } = {}) {
  const opener = app.querySelector("[data-open-translator]");
  if (!opener) return;
  const c = COPY[locale] || COPY.en;
  const overlay = document.createElement("section");
  overlay.className = "translator-overlay"; overlay.hidden = true;
  overlay.innerHTML = '<div class="translator-dialog" role="dialog" aria-modal="true" aria-labelledby="translator-title"><header><div><h2 id="translator-title"></h2><p class="translator-subtitle"></p></div><button type="button" data-translator-close>×</button></header><form class="translator-form"><label data-label-source></label><input name="source" maxlength="80" autocomplete="off"><label data-label-target></label><input name="target" maxlength="80" required placeholder="مثلاً: English, فارسی, العربية"><label data-label-text></label><textarea name="text" rows="7" maxlength="5000" required></textarea><p class="translator-error" role="status" aria-live="polite"></p><button type="submit" class="translator-submit"></button></form><p class="translator-footnote">ترجمه از طریق سرویس هوش مصنوعی پیکربندی‌شده انجام می‌شود؛ کیفیت زبان‌ها و اصطلاحات تخصصی ممکن است متفاوت باشد.</p></div>';
  const sourceSelect = overlay.querySelector('[name="source"]');
  const targetSelect = overlay.querySelector('[name="target"]');
  const addOption = (select, value, label) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  };
  addOption(sourceSelect, "", locale === "fa" ? "تشخیص خودکار" : "Auto-detect");
  for (const language of TRANSLATION_LANGUAGES) {
    addOption(sourceSelect, language.code, language.name);
    addOption(targetSelect, language.code, language.name);
  }
  targetSelect.value = "en";
  const put = (selector, value) => { overlay.querySelector(selector).textContent = value; };
  put("#translator-title", c.title); put(".translator-subtitle", c.subtitle); put("[data-label-source]", c.source); put("[data-label-target]", c.target); put("[data-label-text]", c.text); put(".translator-submit", c.translate);
  overlay.querySelector("[data-translator-close]").setAttribute("aria-label", c.close);
  overlay.querySelector('[name="text"]').placeholder = c.placeholder;
  app.append(overlay);
  const close = () => { overlay.hidden = true; opener.focus(); };
  opener.addEventListener("click", () => { overlay.hidden = false; overlay.querySelector('[name="text"]').focus(); });
  overlay.querySelector("[data-translator-close]").addEventListener("click", close);
  overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
  overlay.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
  overlay.querySelector("form").addEventListener("submit", event => {
    event.preventDefault(); const form = event.currentTarget;
    const sourceCode = form.elements.source.value;\n    const targetName = getTranslationLanguageName(form.elements.target.value);\n    const prompt = buildTranslationPrompt({ source: sourceCode ? getTranslationLanguageName(sourceCode) : "", target: targetName, text: form.elements.text.value });
    const input = app.querySelector("#prompt"), chatForm = app.querySelector("#chat-form");
    const error = overlay.querySelector(".translator-error");
    if (!input || !chatForm) { error.textContent = "بخش گفتگو در دسترس نیست."; return; }
    input.value = prompt; input.dispatchEvent(new Event("input", { bubbles: true })); close(); chatForm.requestSubmit();
  });
}
