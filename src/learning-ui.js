import { getLearningFeedback, recordLearningFeedback } from "./learning-core.js";

const LABELS = {
  fa: ["مفید بود", "مفید نبود", "بازخورد ذخیره شد"],
  en: ["Helpful", "Not helpful", "Feedback saved"],
  de: ["Hilfreich", "Nicht hilfreich", "Feedback gespeichert"],
  ar: ["مفيد", "غير مفيد", "تم حفظ التقييم"],
  tr: ["Yararlı", "Yararlı değil", "Geri bildirim kaydedildi"],
  es: ["Útil", "No útil", "Opinión guardada"],
  fr: ["Utile", "Pas utile", "Avis enregistré"],
  ru: ["Полезно", "Не полезно", "Отзыв сохранён"],
  zh: ["有帮助", "没有帮助", "反馈已保存"],
  hi: ["उपयोगी", "उपयोगी नहीं", "प्रतिक्रिया सहेजी गई"],
  ur: ["مفید", "مفید نہیں", "رائے محفوظ ہوگئی"],
  pt: ["Útil", "Não útil", "Feedback salvo"]
};

export function attachLearningFeedback(container, messages, locale = "fa") {
  const labels = LABELS[locale] || LABELS.en;
  container.querySelectorAll(".msg.assistant").forEach((article, index) => {
    const message = messages.filter(item => item.role === "assistant")[index];
    if (!message?.responseId || article.querySelector(".learning-feedback")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "learning-feedback";
    wrapper.setAttribute("aria-label", labels[2]);
    const status = document.createElement("span");
    status.textContent = labels[2];
    wrapper.append(status);
    for (const rating of [1, 0]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = labels[rating === 1 ? 0 : 1];
      button.dataset.rating = String(rating);
      const current = getLearningFeedback(message.responseId);
      if (current === rating) button.classList.add("selected");
      button.addEventListener("click", () => {
        const saved = recordLearningFeedback({
          responseId: message.responseId,
          category: message.category || "general",
          mode: message.mode || "balanced",
          rating
        });
        if (!saved) return;
        wrapper.querySelectorAll("button").forEach(item => item.classList.toggle("selected", item === button));
        status.textContent = labels[2];
      });
      wrapper.append(button);
    }
    article.append(wrapper);
  });
}
