import "./usage-dashboard.css";

const copy = {
  fa:{button:"گزارش مصرف هوش مصنوعی · ۳۰ روز",loading:"در حال دریافت گزارش…",unavailable:"گزارش مصرف در دسترس نیست؛ ورود و تنظیمات ثبت مصرف را بررسی کنید.",requests:"درخواست‌ها",tokens:"توکن مصرف‌شده",cost:"هزینه تخمینی",unknown:"درخواست بدون نرخ هزینه",providers:"مصرف بر اساس ارائه‌دهنده",recent:"درخواست‌های اخیر",search:"جستجوی وب",yes:"بله",no:"خیر",noData:"داده‌ای برای این بازه ثبت نشده است.",period:"۳۰ روز گذشته"},
  en:{button:"AI usage report · 30 days",loading:"Loading usage report…",unavailable:"Usage report unavailable. Check sign-in and metering configuration.",requests:"Requests",tokens:"Tokens used",cost:"Estimated cost",unknown:"Requests without a cost rate",providers:"Usage by provider",recent:"Recent requests",search:"Web search",yes:"Yes",no:"No",noData:"No usage recorded for this period.",period:"Last 30 days"},
  de:{button:"KI-Verbrauch · 30 Tage",loading:"Bericht wird geladen…",unavailable:"Bericht nicht verfügbar. Anmeldung und Verbrauchserfassung prüfen.",requests:"Anfragen",tokens:"Verbrauchte Tokens",cost:"Geschätzte Kosten",unknown:"Anfragen ohne Kostenrate",providers:"Verbrauch nach Anbieter",recent:"Letzte Anfragen",search:"Websuche",yes:"Ja",no:"Nein",noData:"Keine Nutzung in diesem Zeitraum.",period:"Letzte 30 Tage"},
  ar:{button:"تقرير استخدام الذكاء الاصطناعي · 30 يوماً",loading:"جارٍ تحميل التقرير…",unavailable:"التقرير غير متاح. تحقق من تسجيل الدخول وإعدادات القياس.",requests:"الطلبات",tokens:"الرموز المستخدمة",cost:"التكلفة التقديرية",unknown:"طلبات بلا سعر تكلفة",providers:"الاستخدام حسب المزوّد",recent:"الطلبات الأخيرة",search:"بحث الويب",yes:"نعم",no:"لا",noData:"لا توجد بيانات لهذه الفترة.",period:"آخر 30 يوماً"},
  tr:{button:"Yapay zekâ kullanım raporu · 30 gün",loading:"Rapor yükleniyor…",unavailable:"Rapor kullanılamıyor. Oturumu ve ölçüm ayarlarını kontrol edin.",requests:"İstekler",tokens:"Kullanılan token",cost:"Tahmini maliyet",unknown:"Maliyet oranı olmayan istekler",providers:"Sağlayıcıya göre kullanım",recent:"Son istekler",search:"Web araması",yes:"Evet",no:"Hayır",noData:"Bu dönem için kullanım kaydı yok.",period:"Son 30 gün"},
  es:{button:"Informe de uso de IA · 30 días",loading:"Cargando informe…",unavailable:"Informe no disponible. Comprueba el acceso y la configuración.",requests:"Solicitudes",tokens:"Tokens usados",cost:"Coste estimado",unknown:"Solicitudes sin tarifa",providers:"Uso por proveedor",recent:"Solicitudes recientes",search:"Búsqueda web",yes:"Sí",no:"No",noData:"No hay uso registrado en este periodo.",period:"Últimos 30 días"},
  fr:{button:"Rapport d’utilisation IA · 30 jours",loading:"Chargement du rapport…",unavailable:"Rapport indisponible. Vérifiez la connexion et la configuration.",requests:"Requêtes",tokens:"Tokens utilisés",cost:"Coût estimé",unknown:"Requêtes sans tarif",providers:"Utilisation par fournisseur",recent:"Requêtes récentes",search:"Recherche web",yes:"Oui",no:"Non",noData:"Aucune utilisation enregistrée pour cette période.",period:"30 derniers jours"},
  ru:{button:"Отчёт об использовании ИИ · 30 дней",loading:"Загрузка отчёта…",unavailable:"Отчёт недоступен. Проверьте вход и настройки учёта.",requests:"Запросы",tokens:"Использовано токенов",cost:"Оценочная стоимость",unknown:"Запросы без тарифа",providers:"Использование по провайдерам",recent:"Последние запросы",search:"Веб-поиск",yes:"Да",no:"Нет",noData:"За этот период данных нет.",period:"Последние 30 дней"},
  zh:{button:"AI 使用报告 · 30 天",loading:"正在加载报告…",unavailable:"报告不可用。请检查登录状态和用量设置。",requests:"请求数",tokens:"已用 Token",cost:"预估费用",unknown:"缺少费率的请求",providers:"按服务商统计",recent:"最近请求",search:"网页搜索",yes:"是",no:"否",noData:"此期间暂无使用记录。",period:"过去 30 天"},
  hi:{button:"AI उपयोग रिपोर्ट · 30 दिन",loading:"रिपोर्ट लोड हो रही है…",unavailable:"रिपोर्ट उपलब्ध नहीं है। साइन-इन और उपयोग सेटिंग जाँचें।",requests:"अनुरोध",tokens:"उपयोग किए गए टोकन",cost:"अनुमानित लागत",unknown:"बिना लागत दर वाले अनुरोध",providers:"प्रदाता के अनुसार उपयोग",recent:"हाल के अनुरोध",search:"वेब खोज",yes:"हाँ",no:"नहीं",noData:"इस अवधि के लिए कोई उपयोग दर्ज नहीं है।",period:"पिछले 30 दिन"},
  ur:{button:"AI استعمال کی رپورٹ · ۳۰ دن",loading:"رپورٹ لوڈ ہو رہی ہے…",unavailable:"رپورٹ دستیاب نہیں۔ سائن اِن اور استعمال کی ترتیبات دیکھیں۔",requests:"درخواستیں",tokens:"استعمال شدہ ٹوکن",cost:"تخمینی لاگت",unknown:"لاگت کی شرح کے بغیر درخواستیں",providers:"فراہم کنندہ کے لحاظ سے استعمال",recent:"حالیہ درخواستیں",search:"ویب تلاش",yes:"ہاں",no:"نہیں",noData:"اس مدت کا کوئی ریکارڈ نہیں۔",period:"گزشتہ ۳۰ دن"},
  pt:{button:"Relatório de uso de IA · 30 dias",loading:"Carregando relatório…",unavailable:"Relatório indisponível. Verifique o acesso e a configuração.",requests:"Solicitações",tokens:"Tokens usados",cost:"Custo estimado",unknown:"Solicitações sem tarifa",providers:"Uso por provedor",recent:"Solicitações recentes",search:"Pesquisa na web",yes:"Sim",no:"Não",noData:"Nenhum uso registrado neste período.",period:"Últimos 30 dias"}
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
