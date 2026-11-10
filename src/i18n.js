const DICTIONARIES = {
  fa: { name:"فارسی", dir:"rtl", subtitle:"دستیار هوشمند چندمنظوره", account:"حساب کاربری", beta:"نسخه آزمایشی", greeting:"سلام، چطور می‌توانم", help:"کمکت کنم؟", intro:"سؤال بپرس، ایده‌پردازی کن، متن بنویس یا برای کارهایت برنامه‌ریزی کن.", chat:"گفتگو", clear:"پاک‌کردن گفتگو", placeholder:"پیامت را اینجا بنویس…", send:"ارسال ↑", hint:"Enter برای ارسال · Shift + Enter برای رفتن به خط بعد", notice:"نسخه آزمایشی: گفتگو فقط تا زمان باز بودن این صفحه در حافظه موقت مرورگر نگه داشته می‌شود. اطلاعات محرمانه ارسال نکن." },
  en: { name:"English", dir:"ltr", subtitle:"Multilingual AI assistant", account:"Account", beta:"Beta version", greeting:"Hello, how can I", help:"help you?", intro:"Ask questions, explore ideas, write content, or plan your work.", chat:"Chat", clear:"Clear chat", placeholder:"Type your message…", send:"Send ↑", hint:"Enter to send · Shift + Enter for a new line", notice:"Beta: chat stays in temporary browser memory while this page is open. Do not send sensitive information." },
  de: { name:"Deutsch", dir:"ltr", subtitle:"Mehrsprachiger KI-Assistent", account:"Konto", beta:"Testversion", greeting:"Hallo, wie kann ich", help:"dir helfen?", intro:"Stelle Fragen, entwickle Ideen, schreibe Texte oder plane deine Aufgaben.", chat:"Chat", clear:"Chat löschen", placeholder:"Nachricht eingeben…", send:"Senden ↑", hint:"Enter zum Senden · Shift + Enter für neue Zeile", notice:"Beta: Der Chat bleibt nur während dieser Sitzung im temporären Browserspeicher. Keine vertraulichen Daten senden." },
  ar: { name:"العربية", dir:"rtl", subtitle:"مساعد ذكاء اصطناعي متعدد اللغات", account:"الحساب", beta:"نسخة تجريبية", greeting:"مرحباً، كيف يمكنني", help:"مساعدتك؟", intro:"اطرح الأسئلة، وابتكر الأفكار، واكتب المحتوى، وخطط لأعمالك.", chat:"المحادثة", clear:"مسح المحادثة", placeholder:"اكتب رسالتك…", send:"إرسال ↑", hint:"Enter للإرسال · Shift + Enter لسطر جديد", notice:"نسخة تجريبية: تُحفظ المحادثة مؤقتاً في المتصفح أثناء فتح الصفحة فقط. لا ترسل معلومات سرية." },
  tr: { name:"Türkçe", dir:"ltr", subtitle:"Çok dilli yapay zekâ asistanı", account:"Hesap", beta:"Beta sürümü", greeting:"Merhaba, sana nasıl", help:"yardımcı olabilirim?", intro:"Soru sor, fikir üret, içerik yaz veya işlerini planla.", chat:"Sohbet", clear:"Sohbeti temizle", placeholder:"Mesajını yaz…", send:"Gönder ↑", hint:"Göndermek için Enter · Yeni satır için Shift + Enter", notice:"Beta: Sohbet yalnızca sayfa açıkken geçici tarayıcı belleğinde tutulur. Gizli bilgi gönderme." },
  es: { name:"Español", dir:"ltr", subtitle:"Asistente de IA multilingüe", account:"Cuenta", beta:"Versión beta", greeting:"Hola, ¿cómo puedo", help:"ayudarte?", intro:"Haz preguntas, explora ideas, escribe contenido o planifica tu trabajo.", chat:"Chat", clear:"Borrar chat", placeholder:"Escribe tu mensaje…", send:"Enviar ↑", hint:"Enter para enviar · Shift + Enter para nueva línea", notice:"Beta: el chat permanece en la memoria temporal del navegador mientras esta página está abierta. No envíes información confidencial." },
  fr: { name:"Français", dir:"ltr", subtitle:"Assistant IA multilingue", account:"Compte", beta:"Version bêta", greeting:"Bonjour, comment puis-je", help:"vous aider ?", intro:"Posez des questions, explorez des idées, rédigez ou planifiez vos tâches.", chat:"Discussion", clear:"Effacer la discussion", placeholder:"Écrivez votre message…", send:"Envoyer ↑", hint:"Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne", notice:"Bêta : la discussion reste dans la mémoire temporaire du navigateur tant que cette page est ouverte. N’envoyez pas d’informations sensibles." },
  ru: { name:"Русский", dir:"ltr", subtitle:"Многоязычный ИИ-помощник", account:"Аккаунт", beta:"Бета-версия", greeting:"Здравствуйте, чем я могу", help:"вам помочь?", intro:"Задавайте вопросы, придумывайте идеи, пишите тексты и планируйте задачи.", chat:"Чат", clear:"Очистить чат", placeholder:"Введите сообщение…", send:"Отправить ↑", hint:"Enter — отправить · Shift + Enter — новая строка", notice:"Бета: чат хранится во временной памяти браузера, пока открыта страница. Не отправляйте конфиденциальные данные." },
  zh: { name:"中文", dir:"ltr", subtitle:"多语言人工智能助手", account:"账户", beta:"测试版", greeting:"你好，我能如何", help:"帮助你？", intro:"提出问题、探索创意、撰写内容或规划工作。", chat:"对话", clear:"清除对话", placeholder:"输入消息…", send:"发送 ↑", hint:"Enter 发送 · Shift + Enter 换行", notice:"测试版：页面打开期间，对话仅保存在浏览器临时内存中。请勿发送敏感信息。" },
  hi: { name:"हिन्दी", dir:"ltr", subtitle:"बहुभाषी AI सहायक", account:"खाता", beta:"बीटा संस्करण", greeting:"नमस्ते, मैं आपकी", help:"कैसे मदद कर सकता हूँ?", intro:"प्रश्न पूछें, विचार खोजें, सामग्री लिखें या अपने काम की योजना बनाएं।", chat:"चैट", clear:"चैट साफ़ करें", placeholder:"अपना संदेश लिखें…", send:"भेजें ↑", hint:"भेजने के लिए Enter · नई पंक्ति के लिए Shift + Enter", notice:"बीटा: चैट केवल पेज खुला रहने तक ब्राउज़र की अस्थायी मेमोरी में रहती है। संवेदनशील जानकारी न भेजें।" },
  ur: { name:"اردو", dir:"rtl", subtitle:"کثیر لسانی AI معاون", account:"اکاؤنٹ", beta:"آزمائشی ورژن", greeting:"السلام علیکم، میں آپ کی", help:"کیا مدد کر سکتا ہوں؟", intro:"سوال پوچھیں، خیالات دریافت کریں، مواد لکھیں یا اپنے کام کی منصوبہ بندی کریں۔", chat:"گفتگو", clear:"گفتگو صاف کریں", placeholder:"اپنا پیغام لکھیں…", send:"بھیجیں ↑", hint:"بھیجنے کے لیے Enter · نئی سطر کے لیے Shift + Enter", notice:"آزمائشی ورژن: گفتگو صرف صفحہ کھلا رہنے تک براؤزر کی عارضی میموری میں رہتی ہے۔ خفیہ معلومات نہ بھیجیں۔" },
  pt: { name:"Português", dir:"ltr", subtitle:"Assistente de IA multilíngue", account:"Conta", beta:"Versão beta", greeting:"Olá, como posso", help:"ajudar você?", intro:"Faça perguntas, explore ideias, escreva conteúdo ou planeje seu trabalho.", chat:"Conversa", clear:"Limpar conversa", placeholder:"Digite sua mensagem…", send:"Enviar ↑", hint:"Enter para enviar · Shift + Enter para nova linha", notice:"Beta: a conversa fica na memória temporária do navegador enquanto esta página estiver aberta. Não envie informações confidenciais." }
};
const STORAGE_KEY = "houshyar.locale";
export const localeOptions = Object.entries(DICTIONARIES).map(([code, item]) => ({ code, name: item.name }));
export function getLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICTIONARIES[saved]) return saved;
  } catch {}
  const browser = (navigator.language || "fa").split("-")[0].toLowerCase();
  return DICTIONARIES[browser] ? browser : "fa";
}
export function setLocale(locale) {
  const selected = DICTIONARIES[locale] ? locale : "fa";
  try { localStorage.setItem(STORAGE_KEY, selected); } catch {}
  document.documentElement.lang = selected;
  document.documentElement.dir = DICTIONARIES[selected].dir;
  return selected;
}
export function translate(key, locale = getLocale()) {
  return DICTIONARIES[locale]?.[key] ?? DICTIONARIES.en[key] ?? key;
}
export function localeDirection(locale = getLocale()) {
  return DICTIONARIES[locale]?.dir ?? "ltr";
}
