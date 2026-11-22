import './style.css';
import { initAccountPanel } from './account.js';
import { initAuthFlows } from './auth-flows.js';
import { translate as t, getLocale, setLocale, localeOptions } from './i18n.js';
import { initWorkspace } from './workspace.js';
import { classifyLearningTask, recommendLearningMode } from './learning-core.js';
import { attachLearningFeedback } from './learning-ui.js';
import { initDesignStudio } from './design-studio.js';
import { initMarketplace } from './marketplace.js';
import { initTranslationUI } from './translation-ui.js';
import { loadProviderAvailability } from './provider-availability.js';

const app = document.querySelector('#app');
const RESPONSE_MODE_LABELS = {"fa":["سریع","متعادل","تحلیلی عمیق","خلاق"],"en":["Fast","Balanced","Deep reasoning","Creative"],"de":["Schnell","Ausgewogen","Tiefgehend","Kreativ"],"ar":["سريع","متوازن","استدلال عميق","إبداعي"],"tr":["Hızlı","Dengeli","Derin düşünme","Yaratıcı"],"es":["Rápido","Equilibrado","Razonamiento profundo","Creativo"],"fr":["Rapide","Équilibré","Raisonnement approfondi","Créatif"],"ru":["Быстрый","Сбалансированный","Глубокий анализ","Творческий"],"zh":["快速","均衡","深度推理","创意"],"hi":["तेज़","संतुलित","गहन तर्क","रचनात्मक"],"ur":["تیز","متوازن","گہری سوچ","تخلیقی"],"pt":["Rápido","Equilibrado","Raciocínio profundo","Criativo"]};
const COMPARE_LABELS = {"fa":"مقایسه دو مدل (مصرف بیشتر)","en":"Compare two models (higher usage)","de":"Zwei Modelle vergleichen (mehr Verbrauch)","ar":"مقارنة نموذجين (استهلاك أعلى)","tr":"İki modeli karşılaştır (daha fazla kullanım)","es":"Comparar dos modelos (mayor consumo)","fr":"Comparer deux modèles (consommation accrue)","ru":"Сравнить две модели (больше затрат)","zh":"比较两个模型（消耗更多）","hi":"दो मॉडल तुलना करें (अधिक उपयोग)","ur":"دو ماڈلز کا موازنہ (زیادہ استعمال)","pt":"Comparar dois modelos (maior consumo)"};
const GOOGLE_SEARCH_LABELS = { fa: 'جست‌وجوی وب گوگل و نمایش منابع', en: 'Google web search and sources', de: 'Google-Websuche und Quellen', ar: 'بحث الويب من Google والمصادر', tr: 'Google web araması ve kaynaklar', es: 'Búsqueda web de Google y fuentes', fr: 'Recherche Google et sources', ru: 'Поиск Google и источники', zh: 'Google 网页搜索与来源', hi: 'Google वेब खोज और स्रोत', ur: 'گوگل ویب سرچ اور ذرائع', pt: 'Pesquisa Google e fontes' };
const RESPONSE_MODE_TITLES = {"fa":"حالت پاسخ","en":"Response mode","de":"Antwortmodus","ar":"وضع الاستجابة","tr":"Yanıt modu","es":"Modo de respuesta","fr":"Mode de réponse","ru":"Режим ответа","zh":"回答模式","hi":"उत्तर मोड","ur":"جواب کا انداز","pt":"Modo de resposta"};
const state = { messages: [], busy: false, draft: '', mode: 'auto', compare: false, provider: 'auto', webSearch: false, autoSpeak: false, listening: false };
const DESIGN_STUDIO_LABELS = {fa:'استودیو طراحی',en:'Design Studio',de:'Designstudio',ar:'استوديو التصميم',tr:'Tasarım Stüdyosu',es:'Estudio de diseño',fr:'Studio de design',ru:'Студия дизайна',zh:'设计工作室',hi:'डिज़ाइन स्टूडियो',ur:'ڈیزائن اسٹوڈیو',pt:'Estúdio de design'};
const AUTO_MODE_LABELS = { fa: 'یادگیری خودکار', en: 'Adaptive auto', de: 'Adaptiv automatisch', ar: 'تلقائي متكيف', tr: 'Uyarlanabilir otomatik', es: 'Automático adaptativo', fr: 'Automatique adaptatif', ru: 'Адаптивный авто', zh: '自适应自动', hi: 'अनुकूली ऑटो', ur: 'خودکار موافق', pt: 'Automático adaptativo' };
const escapeHTML = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scrollChat = () => {
  const chat = app.querySelector('.chat');
  if (!chat) return;
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  chat.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'end' });
};

function renderSources(sources, locale) {
  if (!Array.isArray(sources) || !sources.length) return "";
  const safe = sources.slice(0, 5).map(source => {
    try {
      const url = new URL(source?.url);
      if (!["http:", "https:"].includes(url.protocol)) return null;
      const title = typeof source.title === "string" ? source.title.trim().slice(0, 160) : "";
      return title ? '<li><a href="' + escapeHTML(url.href) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(title) + '</a></li>' : null;
    } catch { return null; }
  }).filter(Boolean);
  if (!safe.length) return "";
  const heading = GOOGLE_SEARCH_LABELS[locale] || GOOGLE_SEARCH_LABELS.en;
  return '<aside class="source-list"><strong>' + escapeHTML(heading) + '</strong><ul>' + safe.join("") + '</ul></aside>';
}

function setVoiceStatus(message) { const el = app.querySelector('#voice-status'); if (el) el.textContent = message; }
function speakReply(value) {
 if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') { setVoiceStatus('پخش گفتار در این مرورگر پشتیبانی نمی‌شود.'); return; }
 const map={fa:'fa-IR',en:'en-US',de:'de-DE',ar:'ar-SA',tr:'tr-TR',es:'es-ES',fr:'fr-FR',ru:'ru-RU',zh:'zh-CN',hi:'hi-IN',ur:'ur-PK',pt:'pt-PT'}; const locale=getLocale(), u=new SpeechSynthesisUtterance(String(value).slice(0,12000)); u.lang=map[locale]||'fa-IR';
 const v=window.speechSynthesis.getVoices().find(x=>x.lang.toLowerCase()===u.lang.toLowerCase()); if(v)u.voice=v; u.onstart=()=>setVoiceStatus('هوش‌یار در حال صحبت است…'); u.onend=()=>setVoiceStatus('پخش پاسخ تمام شد.'); u.onerror=()=>setVoiceStatus('پخش صدا ناموفق بود.'); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
}
function startVoiceInput() {
 const R=window.SpeechRecognition||window.webkitSpeechRecognition; if(!R){setVoiceStatus('تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود؛ از Chrome به‌روز استفاده کنید.');return;} if(state.listening)return;
 const r=new R(), map={fa:'fa-IR',en:'en-US',de:'de-DE',ar:'ar-SA',tr:'tr-TR',es:'es-ES',fr:'fr-FR',ru:'ru-RU',zh:'zh-CN',hi:'hi-IN',ur:'ur-PK',pt:'pt-PT'}; r.lang=map[getLocale()]||'fa-IR';r.continuous=false;r.interimResults=false;state.listening=true;const btn=app.querySelector('#voice-input');btn.disabled=true;btn.textContent='…';setVoiceStatus('در حال شنیدن؛ صحبت کنید…');
 r.onresult=e=>{const value=e.results?.[0]?.[0]?.transcript?.trim(),input=app.querySelector('#prompt');if(value&&input){input.value=[input.value.trim(),value].filter(Boolean).join(' ');state.draft=input.value;input.dispatchEvent(new Event('input',{bubbles:true}));setVoiceStatus('گفتار به متن تبدیل شد؛ برای ارسال دکمه ارسال را بزنید.');}};
 r.onerror=e=>setVoiceStatus(e.error==='not-allowed'?'اجازه میکروفون داده نشد؛ مجوز میکروفون را فعال کنید.':'خطای تشخیص گفتار: '+e.error);r.onend=()=>{state.listening=false;const x=app.querySelector('#voice-input');if(x){x.disabled=false;x.textContent='🎙️';}};try{r.start();}catch{state.listening=false;btn.disabled=false;btn.textContent='🎙️';setVoiceStatus('شروع میکروفون ناموفق بود.');}
}
function render() {
  const locale = getLocale();
  setLocale(locale);
  app.innerHTML = `
    <header class="top"><div class="brand"><img class="logo" src="/brand/mark.svg" alt="${t('logoAlt',locale)}" width="44" height="44"><div><strong>هوش‌یار</strong><small>${t('subtitle',locale)}</small></div></div><div class="top-actions"><select id="locale-select" class="locale-select" aria-label="${t('localeSelectLabel',locale)}">${localeOptions.map(item=>'<option value="'+item.code+'" '+(item.code===locale?'selected':'')+'>'+item.name+'</option>').join('')}</select><button id="workspace-open" type="button" class="account-open">${t("workspace",locale)}</button><button id="account-open" type="button" class="account-open">${t('account',locale)}</button><span class="status"><i></i> ${t('beta',locale)}</span></div></header>
    <main><section class="welcome"><span class="eyebrow">HOUSHYAR AI</span><h1>${t('greeting',locale)}<br><em>${t('help',locale)}</em></h1><p>${t('intro',locale)}</p></section>
    <section class="toolbox" aria-labelledby="toolbox-title"><div class="toolbox-heading"><h2 id="toolbox-title">${t('toolboxTitle',locale)}</h2><p>${t('toolboxDesc',locale)}</p></div><div class="toolbox-grid">
      <button type="button" data-prompt="${escapeHTML(t('toolResearchPrompt',locale))}"><span>⌕</span><b>${t('toolResearch',locale)}</b></button>
      <button type="button" data-prompt="${escapeHTML(t('toolBusinessPrompt',locale))}"><span>↗</span><b>${t('toolBusiness',locale)}</b></button>
      <button type="button" data-prompt="${escapeHTML(t('toolCodingPrompt',locale))}"><span>{ }</span><b>${t('toolCoding',locale)}</b></button>
      <button type="button" data-prompt="${escapeHTML(t('toolTranslatePrompt',locale))}"><span>文</span><b>${t('toolTranslate',locale)}</b></button>
      <button type="button" data-prompt="${escapeHTML(t('toolImagePrompt',locale))}"><span>✧</span><b>${t('toolImage',locale)}</b></button>
      <button type="button" data-prompt="${escapeHTML(t('toolStudyPrompt',locale))}"><span>◎</span><b>${t('toolStudy',locale)}</b></button>
      <button type="button" data-open-design-studio><span>✦</span><b>${DESIGN_STUDIO_LABELS[locale] || DESIGN_STUDIO_LABELS.en}</b></button>
      <button type="button" data-open-marketplace><span>▦</span><b>${locale === "fa" ? "بازارگاه" : "Marketplace"}</b></button>
    </div></section>
    <section class="suggestions" aria-label="${t('suggestionsLabel',locale)}">
      <button type="button" data-prompt="${escapeHTML(t('promptIdea',locale))}">💡 ${t('idea',locale)} <small>${t('ideaDesc',locale)}</small></button>
      <button type="button" data-prompt="${escapeHTML(t('promptLearning',locale))}">📚 ${t('learning',locale)} <small>${t('learningDesc',locale)}</small></button>
      <button type="button" data-prompt="${escapeHTML(t('promptContent',locale))}">✍️ ${t('content',locale)} <small>${t('contentDesc',locale)}</small></button>
      <button type="button" data-prompt="${escapeHTML(t('promptPlanning',locale))}">🧭 ${t('planning',locale)} <small>${t('planningDesc',locale)}</small></button>
    </section>
    <div class="chat-tools"><label class="auto-speak"><input id="auto-speak" type="checkbox" ${state.autoSpeak ? "checked" : ""}> پاسخ صوتی خودکار</label><span>${t('chat',locale)}</span><button id="clear-chat" type="button" ${state.messages.length || state.draft ? '' : 'disabled'}>${t('clear',locale)}</button></div>
    <section class="chat" aria-live="polite" aria-label="${t('chatMessagesLabel',locale)}">${state.messages.map((m,i)=>`<article class="msg ${m.role}"><div class="msg-head"><b>${m.role==='user'?t('you',locale):t('assistant',locale)}</b>${m.agent?'<small class="agent-label"> · '+escapeHTML(m.agent.label)+'</small>':''}${m.role==='assistant'?'<button type="button" class="copy-reply" data-index="'+i+'" aria-label="'+t('copy',locale)+'">'+t('copy',locale)+'</button>':''}</div><p>${escapeHTML(m.text)}</p>${renderSources(m.sources,locale)}</article>`).join('')}${state.busy?'<article class="msg assistant" role="status"><b>'+t('assistant',locale)+'</b><p>'+t('thinking',locale)+'</p></article>':''}</section>
    <div class="mode-control"><label for="ai-provider">موتور هوش مصنوعی</label><select id="ai-provider" aria-label="AI provider"><option value="auto" ${state.provider==='auto'?'selected':''}>انتخاب خودکار</option><option value="groq" ${state.provider==='groq'?'selected':''}>Groq</option><option value="anthropic" ${state.provider==='anthropic'?'selected':''}>Claude (Anthropic)</option><option value="google" ${state.provider==='google'?'selected':''}>Google Gemini</option><option value="deepseek" ${state.provider==='deepseek'?'selected':''}>DeepSeek</option><option value="cloudflare_ai" ${state.provider==='cloudflare_ai'?'selected':''}>Cloudflare AI (سهمیه رایگان)</option></select><label class="compare-toggle"><input id="compare-models" type="checkbox" ${state.compare ? "checked" : ""} ${state.webSearch || state.provider === "cloudflare_ai" ? "disabled" : ""}> ${COMPARE_LABELS[locale] || COMPARE_LABELS.en}</label><label class="web-search-toggle"><input id="google-web-search" type="checkbox" ${state.webSearch ? "checked" : ""} ${state.provider === "google" ? "" : "disabled"}> ${GOOGLE_SEARCH_LABELS[locale] || GOOGLE_SEARCH_LABELS.en}</label><label for="response-mode">${RESPONSE_MODE_TITLES[locale] || "Response mode"}</label><select id="response-mode" aria-label="Response mode">${["auto","fast","balanced","deep","creative"].map((mode,i)=>'<option value="'+mode+'" '+(state.mode===mode?'selected':'')+'>'+(mode === 'auto' ? (AUTO_MODE_LABELS[locale] || AUTO_MODE_LABELS.en) : RESPONSE_MODE_LABELS[locale][i-1])+'</option>').join('')}</select></div>\n    <div id="voice-status" class="voice-status" role="status" aria-live="polite">برای گفتار، دکمه میکروفون را بزنید.</div><form id="chat-form"><button id="voice-input" type="button" class="voice-input" aria-label="گفتار به متن">🎙️</button><textarea id="prompt" aria-label="${t('messageInputLabel',locale)}" rows="1" maxlength="6000" placeholder="${t('placeholder',locale)}" required>${escapeHTML(state.draft)}</textarea><button id="send" type="submit" ${state.busy?'disabled':''}>${t('send',locale)}</button></form>
    <p class="input-hint">${t('hint',locale)}</p>
    <p class="notice">${t('notice',locale)}</p></main>
    <footer>${t('footer',locale)}</footer>`;
  initTranslationUI(app);
  void loadProviderAvailability(app.querySelector('#ai-provider'));
  attachLearningFeedback(app.querySelector('.chat'), state.messages, locale);
  initDesignStudio(app, { locale });
  initMarketplace(app, { locale });
  app.querySelector('#locale-select').addEventListener('change', event => { setLocale(event.target.value); render(); });
  initAccountPanel(app);
  initAuthFlows(app);
  initWorkspace(app, { getMessages: () => state.messages, onLoadConversation: messages => { state.messages = Array.isArray(messages) ? messages.filter(m => m && ['user','assistant'].includes(m.role)).slice(-50).map(m => ({ role: m.role, text: String(m.text || '').slice(0,12000) })) : []; state.draft = ''; render(); scrollChat(); }, onUsePrompt: value => { state.draft = value; render(); const input = app.querySelector('#prompt'); input.focus(); input.setSelectionRange(input.value.length,input.value.length); } });
  app.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{const input=app.querySelector('#prompt');state.draft=b.dataset.prompt;input.value=state.draft;input.focus();}));
  const prompt=app.querySelector('#prompt');
  const resize=()=>{prompt.style.height='auto';prompt.style.height=Math.min(prompt.scrollHeight,160)+'px';};
  prompt.addEventListener('input',()=>{state.draft=prompt.value;resize();});
  prompt.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();app.querySelector('#chat-form').requestSubmit();}});
  resize();
  app.querySelector('#response-mode').addEventListener('change', event => { state.mode = ['auto','fast','balanced','deep','creative'].includes(event.target.value) ? event.target.value : 'auto'; });
  app.querySelector('#compare-models').addEventListener('change', event => { state.compare = event.target.checked === true; });
  app.querySelector('#ai-provider').addEventListener('change', event => { state.provider = ['auto','groq','anthropic','google','deepseek','cloudflare_ai'].includes(event.target.value) ? event.target.value : 'auto'; if (state.provider !== 'google') state.webSearch = false; if (state.provider === 'cloudflare_ai') state.compare = false; render(); });
  app.querySelector('#google-web-search').addEventListener('change', event => { state.webSearch = event.target.checked === true && state.provider === 'google'; if (state.webSearch) state.compare = false; render(); });
  app.querySelector('#chat-form').addEventListener('submit',submitMessage);
  app.querySelector('#auto-speak').addEventListener('change', event => { state.autoSpeak = event.target.checked; });
  app.querySelector('#voice-input').addEventListener('click', startVoiceInput);
  app.querySelector('#clear-chat').addEventListener('click',()=>{if(state.busy)return;state.messages=[];state.draft='';render();});
  app.querySelectorAll('.copy-reply').forEach(button=>button.addEventListener('click',async()=>{const reply=state.messages[Number(button.dataset.index)]?.text;if(!reply)return;try{await navigator.clipboard.writeText(reply);button.textContent=t('copyDone',getLocale());}catch{button.textContent=t('copyFailed',getLocale());}}));
}

async function submitMessage(event) {
  event.preventDefault();
  const input=app.querySelector('#prompt'); const text=input.value.trim();
  if(!text || state.busy) return;
  state.draft='';
  const learningMode = state.mode === 'auto' ? recommendLearningMode(text) : state.mode;
  state.messages.push({role:'user',text});
  state.busy=true; render(); scrollChat();
  try {
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:state.messages.slice(-11),mode:learningMode,compare:state.compare,provider:state.provider,webSearch:state.webSearch})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) {
      const errorKeys={AI_NOT_CONFIGURED:'errorAiNotConfigured',BODY_TOO_LARGE:'errorBodyTooLarge',MESSAGE_TOO_LONG:'errorMessageTooLong',UPSTREAM_TIMEOUT:'errorUpstreamTimeout',UPSTREAM_ERROR:'errorUpstreamUnavailable',UPSTREAM_UNAVAILABLE:'errorUpstreamUnavailable',COMPARE_NOT_CONFIGURED:'errorAiNotConfigured',PROVIDER_NOT_CONFIGURED:'errorAiNotConfigured',COMPARISON_FAILED:'errorUpstreamUnavailable'};
      throw new Error(t(errorKeys[data.error] || 'errorGeneric',getLocale()));
    }
    state.messages.push({role:'assistant',text:data.reply || 'پاسخ خالی از سرویس دریافت شد.',agent:data.agent || null,provider:data.provider || null,sources:Array.isArray(data.sources)?data.sources:[],responseId:crypto.randomUUID(),category:data.agent?.id || classifyLearningTask(text),mode:learningMode});
    if(state.autoSpeak)speakReply(data.reply || 'پاسخ خالی از سرویس دریافت شد.');
  } catch(error) {
    state.messages.push({role:'assistant',text:error.message || t('errorGeneric',getLocale())});
  } finally { state.busy=false; render(); scrollChat(); }
}

render();
