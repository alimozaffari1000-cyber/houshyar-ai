import './style.css';
import { initAccountPanel } from './account.js';
import { initAuthFlows } from './auth-flows.js';
import { translate as t, getLocale, setLocale, localeOptions } from './i18n.js';
import { initWorkspace } from './workspace.js';
import { classifyLearningTask, recommendLearningMode } from './learning-core.js';
import { attachLearningFeedback } from './learning-ui.js';
import { initDesignStudio } from './design-studio.js';
import { initMarketplace } from './marketplace.js';
import { initVisualCommerce } from './visual-commerce.js';
import { normalizeChatHistory } from './chat-memory.js';
import { readChatPreferences, saveChatPreferences } from './chat-preferences.js';
import { normalizeProviderStatus, providerStatusLabel } from './provider-status.js';

const app = document.querySelector('#app');
const RESPONSE_MODE_LABELS = {"fa":["سریع","متعادل","تحلیلی عمیق","خلاق"],"en":["Fast","Balanced","Deep reasoning","Creative"],"de":["Schnell","Ausgewogen","Tiefgehend","Kreativ"],"ar":["سريع","متوازن","استدلال عميق","إبداعي"],"tr":["Hızlı","Dengeli","Derin düşünme","Yaratıcı"],"es":["Rápido","Equilibrado","Razonamiento profundo","Creativo"],"fr":["Rapide","Équilibré","Raisonnement approfondi","Créatif"],"ru":["Быстрый","Сбалансированный","Глубокий анализ","Творческий"],"zh":["快速","均衡","深度推理","创意"],"hi":["तेज़","संतुलित","गहन तर्क","रचनात्मक"],"ur":["تیز","متوازن","گہری سوچ","تخلیقی"],"pt":["Rápido","Equilibrado","Raciocínio profundo","Criativo"]};
const COMPARE_LABELS = {"fa":"مقایسه دو مدل (مصرف بیشتر)","en":"Compare two models (higher usage)","de":"Zwei Modelle vergleichen (mehr Verbrauch)","ar":"مقارنة نموذجين (استهلاك أعلى)","tr":"İki modeli karşılaştır (daha fazla kullanım)","es":"Comparar dos modelos (mayor consumo)","fr":"Comparer deux modèles (consommation accrue)","ru":"Сравнить две модели (больше затрат)","zh":"比较两个模型（消耗更多）","hi":"दो मॉडल तुलना करें (अधिक उपयोग)","ur":"دو ماڈلز کا موازنہ (زیادہ استعمال)","pt":"Comparar dois modelos (maior consumo)"};
const RESPONSE_MODE_TITLES = {"fa":"حالت پاسخ","en":"Response mode","de":"Antwortmodus","ar":"وضع الاستجابة","tr":"Yanıt modu","es":"Modo de respuesta","fr":"Mode de réponse","ru":"Режим ответа","zh":"回答模式","hi":"उत्तर मोड","ur":"جواب کا انداز","pt":"Modo de resposta"};
const CHAT_HISTORY_KEY = 'houshyar.chat.sessions.v1';
const CANCEL_LABELS = {fa:'توقف پاسخ',en:'Stop generating',de:'Antwort stoppen',ar:'إيقاف الإجابة',tr:'Yanıtı durdur',es:'Detener respuesta',fr:'Arrêter la réponse',ru:'Остановить ответ',zh:'停止生成',hi:'उत्तर रोकें',ur:'جواب روکیں',pt:'Parar resposta'};
const readChatHistory = () => { try { return normalizeChatHistory(JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '[]')); } catch { return []; } };
const makeId = () => globalThis.crypto?.randomUUID?.() || 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
const chatPreferences = readChatPreferences();
const state = { messages: [], busy: false, requestController: null, draft: '', mode: chatPreferences.mode, compare: chatPreferences.compare, googleSearch: chatPreferences.googleSearch, provider: chatPreferences.provider, providerStatus: null, providerStatusLoaded: false, conversations: readChatHistory(), activeConversationId: null, sidebarOpen: false, attachments: [], attachmentNotice: '' };
const persistChatPreferences = () => saveChatPreferences({ provider: state.provider, mode: state.mode, compare: state.compare, googleSearch: state.googleSearch });
const DESIGN_STUDIO_LABELS = {fa:'استودیو طراحی',en:'Design Studio',de:'Designstudio',ar:'استوديو التصميم',tr:'Tasarım Stüdyosu',es:'Estudio de diseño',fr:'Studio de design',ru:'Студия дизайна',zh:'设计工作室',hi:'डिज़ाइन स्टूडियो',ur:'ڈیزائن اسٹوڈیو',pt:'Estúdio de design'};
const AUTO_MODE_LABELS = { fa: 'یادگیری خودکار', en: 'Adaptive auto', de: 'Adaptiv automatisch', ar: 'تلقائي متكيف', tr: 'Uyarlanabilir otomatik', es: 'Automático adaptativo', fr: 'Automatique adaptatif', ru: 'Адаптивный авто', zh: '自适应自动', hi: 'अनुकूली ऑटो', ur: 'خودکار موافق', pt: 'Automático adaptativo' };
const escapeHTML = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function formatMessage(value='') {
  const blocks = [];
  let html = escapeHTML(value).replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (_match, language, code) => {
    const index = blocks.push('<pre class="chat-code"><div class="chat-code-head">' + escapeHTML(language || 'code') + '</div><code>' + code.replace(/\n$/, '') + '</code></pre>') - 1;
    return '__HOUSHYAR_CODE_BLOCK_' + index + '__';
  });
  html = html
    .replace(/`([^`\n]+)`/g, '<code class="chat-inline-code">$1</code>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(?:<li>.*<\/li>\n?)+/g, match => '<ul>' + match + '</ul>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  return html.replace(/__HOUSHYAR_CODE_BLOCK_(\d+)__/g, (_match, index) => blocks[Number(index)] || '');
}

function saveCurrentConversation() {
  if (!state.messages.length) return;
  const firstUser = state.messages.find(message => message.role === 'user');
  const conversation = { id: state.activeConversationId || makeId(), title: String(firstUser?.text || 'گفتگوی جدید').replace(/\s+/g, ' ').slice(0, 56), messages: state.messages.slice(-30).map(message => ({ role: message.role, text: String(message.text || '').slice(0, 6000), agent: message.agent || null, collaboration: message.collaboration || null })), updatedAt: new Date().toISOString() };
  state.activeConversationId = conversation.id;
  state.conversations = [conversation, ...state.conversations.filter(item => item.id !== conversation.id)].slice(0, 40);
  try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(state.conversations)); } catch { /* current in-memory chat remains available */ }
}
function renderConversationList() {
  return state.conversations.map(item => '<button type="button" class="history-item ' + (item.id === state.activeConversationId ? 'active' : '') + '" data-chat-id="' + escapeHTML(item.id) + '"><span>◷</span><span class="history-item-title">' + escapeHTML(item.title || 'گفتگو') + '</span><span class="history-item-delete" data-delete-chat="' + escapeHTML(item.id) + '" role="button" aria-label="حذف گفتگو">×</span></button>').join('') || '<p class="history-empty">گفتگوی قبلی اینجا نمایش داده می‌شود.</p>';
}
function startNewChat() { if (state.busy) return; saveCurrentConversation(); state.messages = []; state.draft = ''; state.activeConversationId = null; state.sidebarOpen = false; render(); app.querySelector('#prompt')?.focus(); }
const scrollChat = () => {
  const chat = app.querySelector('.chat');
  if (!chat) return;
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  chat.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'end' });
};

function render() {
  const locale = getLocale();
  setLocale(locale);
  app.innerHTML = `
    <header class="top"><div class="brand"><img class="logo" src="/brand/mark.svg" alt="${t('logoAlt',locale)}" width="44" height="44"><div><strong>هوش‌یار</strong><small>${t('subtitle',locale)}</small></div></div><div class="top-actions"><select id="locale-select" class="locale-select" aria-label="${t('localeSelectLabel',locale)}">${localeOptions.map(item=>'<option value="'+item.code+'" '+(item.code===locale?'selected':'')+'>'+item.name+'</option>').join('')}</select><button id="workspace-open" type="button" class="account-open">${t("workspace",locale)}</button><button id="account-open" type="button" class="account-open">${t('account',locale)}</button><span class="status"><i></i> ${t('beta',locale)}</span></div></header>
    <div class="chat-layout">
      <aside class="chat-sidebar ${state.sidebarOpen ? 'open' : ''}" aria-label="تاریخچه گفتگوها">
        <button type="button" class="new-chat-button" id="new-chat"><span>＋</span> گفتگوی جدید</button>
        <div class="sidebar-section-label">گفتگوهای اخیر</div>
        <nav class="chat-history-list" aria-label="گفتگوهای قبلی">${renderConversationList()}</nav>
        <div class="sidebar-bottom"><span class="sidebar-avatar">ه</span><span><b>هوش‌یار</b><small>دستیار هوشمند</small></span><button type="button" id="sidebar-workspace" title="فضای کاری">•••</button></div>
      </aside>
      <div class="chat-main">
        <div class="mobile-chat-bar"><button type="button" id="sidebar-toggle" aria-label="نمایش تاریخچه">☰</button><span>هوش‌یار</span><button type="button" id="mobile-new-chat" aria-label="گفتگوی جدید">＋</button></div>
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
      <button type="button" data-open-visual-commerce><span>✧</span><b>${locale === "fa" ? "تجربه مجازی" : "Virtual try-on"}</b></button>
    </div></section>
    <section class="suggestions" aria-label="${t('suggestionsLabel',locale)}">
      <button type="button" data-prompt="${escapeHTML(t('promptIdea',locale))}">💡 ${t('idea',locale)} <small>${t('ideaDesc',locale)}</small></button>
      <button type="button" data-prompt="${escapeHTML(t('promptLearning',locale))}">📚 ${t('learning',locale)} <small>${t('learningDesc',locale)}</small></button>
      <button type="button" data-prompt="${escapeHTML(t('promptContent',locale))}">✍️ ${t('content',locale)} <small>${t('contentDesc',locale)}</small></button>
      <button type="button" data-prompt="${escapeHTML(t('promptPlanning',locale))}">🧭 ${t('planning',locale)} <small>${t('planningDesc',locale)}</small></button>
    </section>
    <div class="chat-tools"><span>${t('chat',locale)}</span><button id="clear-chat" type="button" ${state.messages.length || state.draft ? '' : 'disabled'}>${t('clear',locale)}</button></div>
    <section class="chat" aria-live="polite" aria-label="${t('chatMessagesLabel',locale)}">${state.messages.map((m,i)=>`<article class="msg ${m.role}"><div class="msg-head"><b>${m.role==='user'?t('you',locale):t('assistant',locale)}</b>${m.agent?'<small class="agent-label"> · '+escapeHTML(m.agent.label)+'</small>':''}${m.collaboration?.enabled?'<small class="collaboration-label"> · '+(m.collaboration.status==='completed'?'بازبینی چندعاملی':'بازبینی ناقص')+'</small>':''}${m.role==='assistant'?'<button type="button" class="copy-reply" data-index="'+i+'" aria-label="'+t('copy',locale)+'">'+t('copy',locale)+'</button>':''}</div><div class="message-content">${formatMessage(m.text)}</div></article>`).join('')}${state.busy?'<article class="msg assistant" role="status"><b>'+t('assistant',locale)+'</b><p>'+t('thinking',locale)+'</p><button type="button" id="cancel-response" class="cancel-response">'+(CANCEL_LABELS[locale]||CANCEL_LABELS.en)+'</button></article>':''}</section>
    <div class="mode-control"><label for="ai-provider">موتور هوش مصنوعی</label><select id="ai-provider" aria-label="AI provider"><option value="auto" ${state.provider==='auto'?'selected':''}>انتخاب خودکار</option><option value="groq" ${state.provider==='groq'?'selected':''}>Groq</option><option value="openai" ${state.provider==='openai'?'selected':''}>OpenAI</option><option value="anthropic" ${state.provider==='anthropic'?'selected':''}>Claude (Anthropic)</option><option value="gemini" ${state.provider==='gemini'?'selected':''}>Google Gemini</option></select><span id="provider-status" class="provider-status" role="status" aria-live="polite"></span><label class="compare-toggle"><input id="compare-models" type="checkbox" ${state.compare ? "checked" : ""}> ${COMPARE_LABELS[locale] || COMPARE_LABELS.en}</label><label class="compare-toggle"><input id="google-search" type="checkbox" ${state.googleSearch ? "checked" : ""}> ${locale === "fa" ? "جست‌وجوی گوگل برای پاسخ‌های به‌روز" : "Google Search for current answers"}</label><label for="response-mode">${RESPONSE_MODE_TITLES[locale] || "Response mode"}</label><select id="response-mode" aria-label="Response mode">${["auto","fast","balanced","deep","creative"].map((mode,i)=>'<option value="'+mode+'" '+(state.mode===mode?'selected':'')+'>'+(mode === 'auto' ? (AUTO_MODE_LABELS[locale] || AUTO_MODE_LABELS.en) : RESPONSE_MODE_LABELS[locale][i-1])+'</option>').join('')}</select></div>\n    <div class="attachment-list" id="attachment-list" aria-live="polite">${state.attachments.map((item,index)=>'<span class="attachment-chip">📎 '+escapeHTML(item.name)+' <button type="button" data-remove-attachment="'+index+'" aria-label="حذف پیوست">×</button></span>').join('')}${state.attachmentNotice?'<span class="attachment-notice">'+escapeHTML(state.attachmentNotice)+'</span>':''}</div>
    <form id="chat-form"><input id="chat-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.txt,.md,.csv" multiple hidden><button id="attach-file" type="button" class="attach-file" aria-label="${locale==='fa'?'افزودن تصویر یا فایل':'Attach image or file'}" title="${locale==='fa'?'افزودن تصویر یا فایل':'Attach image or file'}">＋</button><textarea id="prompt" aria-label="${t('messageInputLabel',locale)}" rows="1" maxlength="6000" placeholder="${t('placeholder',locale)}">${escapeHTML(state.draft)}</textarea><button id="send" type="submit" ${state.busy?'disabled':''}>${t('send',locale)}</button></form>
    <p class="input-hint">${t('hint',locale)} · ${locale==='fa'?'تصویر تا ۲ مگابایت؛ فایل متنی تا ۴ کیلوبایت':'Images up to 2 MB; text files up to 4 KB'}</p>
    <p class="notice">${t('notice',locale)}</p></main>
      </div>
    </div>
    <footer>${t('footer',locale)}</footer>`;
  const providerSelect = app.querySelector('#ai-provider');
  const providerStatusNode = app.querySelector('#provider-status');
  const applyProviderStatus = () => {
    if (!state.providerStatus) {
      providerStatusNode.textContent = locale === 'fa' ? 'وضعیت موتورهای هوش مصنوعی در حال بررسی است…' : 'Checking AI provider configuration…';
      return;
    }
    const selected = state.provider === 'auto' ? null : state.provider;
    providerStatusNode.textContent = selected
      ? providerStatusLabel(selected, state.providerStatus, locale)
      : (state.providerStatus.status === 'configured'
        ? (locale === 'fa' ? 'حداقل یک موتور پیکربندی شده است' : 'At least one provider is configured')
        : (locale === 'fa' ? 'نیازمند تنظیم کلید API در سرور' : 'Server API key setup required'));
    for (const option of providerSelect.options) {
      if (option.value === 'auto') continue;
      const base = option.value === 'anthropic' ? 'Claude (Anthropic)' : option.value === 'openai' ? 'OpenAI' : option.value === 'gemini' ? 'Google Gemini' : 'Groq';
      option.textContent = base + ' — ' + providerStatusLabel(option.value, state.providerStatus, locale);
    }
  };
  applyProviderStatus();
  if (!state.providerStatusLoaded) {
    state.providerStatusLoaded = true;
    fetch('/api/chat', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(response => response.json())
      .then(payload => { state.providerStatus = normalizeProviderStatus(payload); applyProviderStatus(); })
      .catch(() => { state.providerStatus = normalizeProviderStatus(null); applyProviderStatus(); });
  }
  attachLearningFeedback(app.querySelector('.chat'), state.messages, locale);
  initDesignStudio(app, { locale });
  initMarketplace(app, { locale });
  initVisualCommerce(app, { locale });
  app.querySelector('#new-chat').addEventListener('click', startNewChat);
  app.querySelector('#mobile-new-chat').addEventListener('click', startNewChat);
  app.querySelector('#sidebar-toggle').addEventListener('click', () => { state.sidebarOpen = !state.sidebarOpen; app.querySelector('.chat-sidebar').classList.toggle('open', state.sidebarOpen); });
  app.querySelector('#sidebar-workspace').addEventListener('click', () => app.querySelector('#workspace-open')?.click());
  app.querySelectorAll('[data-chat-id]').forEach(button => button.addEventListener('click', event => {
    if (event.target.closest('[data-delete-chat]')) return;
    const item = state.conversations.find(entry => entry.id === button.dataset.chatId);
    if (!item || state.busy) return;
    saveCurrentConversation(); state.activeConversationId = item.id;
    state.messages = item.messages.map(message => ({ role: message.role, text: message.text, agent: message.agent || null, collaboration: message.collaboration || null }));
    state.draft = ''; state.sidebarOpen = false; render(); scrollChat();
  }));
  app.querySelectorAll('[data-delete-chat]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation(); const id = button.dataset.deleteChat;
    state.conversations = state.conversations.filter(item => item.id !== id);
    try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(state.conversations)); } catch {}
    if (state.activeConversationId === id) { state.activeConversationId = null; state.messages = []; }
    render();
  }));
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
  app.querySelector('#response-mode').addEventListener('change', event => { state.mode = ['auto','fast','balanced','deep','creative'].includes(event.target.value) ? event.target.value : 'auto'; persistChatPreferences(); });
  app.querySelector('#compare-models').addEventListener('change', event => { state.compare = event.target.checked === true; persistChatPreferences(); });
  app.querySelector('#ai-provider').addEventListener('change', event => { state.provider = ['auto','groq','openai','anthropic'].includes(event.target.value) ? event.target.value : 'auto'; persistChatPreferences(); });
  app.querySelector('#chat-form').addEventListener('submit',submitMessage);
  app.querySelector('#attach-file').addEventListener('click',()=>app.querySelector('#chat-file-input').click());
  app.querySelector('#chat-file-input').addEventListener('change',async event=>{
    state.attachmentNotice='';
    for(const file of Array.from(event.target.files||[])){
      if(state.attachments.length>=4){state.attachmentNotice=getLocale()==='fa'?'حداکثر ۴ پیوست مجاز است.':'Maximum 4 attachments.';break;}
      const isImage=['image/jpeg','image/png','image/webp','image/gif'].includes(file.type);
      if(isImage){
        if(file.size>2*1024*1024){state.attachmentNotice=getLocale()==='fa'?'حجم هر تصویر باید حداکثر ۲ مگابایت باشد.':'Each image must be 2 MB or less.';continue;}
        if(state.attachments.filter(item=>item.kind==='image').length>=2){state.attachmentNotice=getLocale()==='fa'?'حداکثر ۲ تصویر مجاز است.':'Maximum 2 images.';continue;}
        const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=reject;reader.readAsDataURL(file);});
        state.attachments.push({kind:'image',name:file.name,mimeType:file.type,data});
      }else if(['text/plain','text/markdown','text/csv'].includes(file.type)||/\.(txt|md|csv)$/i.test(file.name)){
        if(file.size>4096){state.attachmentNotice=getLocale()==='fa'?'فایل متنی باید حداکثر ۴ کیلوبایت باشد.':'Text files must be 4 KB or less.';continue;}
        try{state.attachments.push({kind:'text',name:file.name,content:await file.text()});}
        catch{state.attachmentNotice=getLocale()==='fa'?'خواندن فایل ناموفق بود.':'Could not read file.';}
      }else{
        state.attachmentNotice=getLocale()==='fa'?'این نوع فایل پشتیبانی نمی‌شود.':'Unsupported file type.';
      }
    }
    event.target.value='';
    render();
  });
  app.querySelectorAll('[data-remove-attachment]').forEach(button=>button.addEventListener('click',()=>{
    state.attachments.splice(Number(button.dataset.removeAttachment),1);render();
  }));
  app.querySelector('#cancel-response')?.addEventListener('click',()=>state.requestController?.abort());
  app.querySelector('#clear-chat').addEventListener('click',()=>{if(state.busy)return;state.messages=[];state.draft='';state.activeConversationId=null;render();});
  app.querySelectorAll('.copy-reply').forEach(button=>button.addEventListener('click',async()=>{const reply=state.messages[Number(button.dataset.index)]?.text;if(!reply)return;try{await navigator.clipboard.writeText(reply);button.textContent=t('copyDone',getLocale());}catch{button.textContent=t('copyFailed',getLocale());}}));
}

async function submitMessage(event) {
  event.preventDefault();
  const input=app.querySelector('#prompt');
  const promptText=input.value.trim();
  if((!promptText && !state.attachments.length) || state.busy) return;
  const imageAttachments=state.attachments.filter(item=>item.kind==='image');
  const textAttachments=state.attachments.filter(item=>item.kind==='text');
  const textContent=textAttachments.map(item=>'\n\n--- فایل: '+item.name+' ---\n'+item.content).join('');
  const imageLabels=imageAttachments.map(item=>'[تصویر پیوست‌شده: '+item.name+']').join('\n');
  const text=(promptText || (imageAttachments.length?'این تصویر را بررسی و توصیف کن.':'فایل پیوست‌شده را بررسی کن.'))+textContent+(imageLabels?'\n'+imageLabels:'');
  const imagePayload=imageAttachments.map(item=>({mimeType:item.mimeType,data:item.data.split(',').pop()}));
  state.attachments=[];state.attachmentNotice='';
  state.draft='';
  const learningMode = state.mode === 'auto' ? recommendLearningMode(text) : state.mode;
  state.messages.push({role:'user',text});
  saveCurrentConversation();
  state.busy=true; state.requestController=new AbortController(); render(); scrollChat();
  let streamingMessage = null;
  try {
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/event-stream, application/json'},signal:state.requestController.signal,body:JSON.stringify({message:text,history:state.messages.slice(-11),mode:state.mode,compare:state.compare,provider:state.provider,googleSearch:state.googleSearch,stream:true,attachments:imagePayload})});
    if(!response.ok) {
      const data=await response.json().catch(()=>({}));
      const errorKeys={AI_NOT_CONFIGURED:'errorAiNotConfigured',BODY_TOO_LARGE:'errorBodyTooLarge',MESSAGE_TOO_LONG:'errorMessageTooLong',UPSTREAM_TIMEOUT:'errorUpstreamTimeout',UPSTREAM_ERROR:'errorUpstreamUnavailable',UPSTREAM_UNAVAILABLE:'errorUpstreamUnavailable',COMPARE_NOT_CONFIGURED:'errorAiNotConfigured',PROVIDER_NOT_CONFIGURED:'errorAiNotConfigured',COMPARISON_FAILED:'errorUpstreamUnavailable',REQUEST_CANCELLED:'errorGeneric',INVALID_ATTACHMENTS:'errorGeneric',ATTACHMENT_TOO_LARGE:'errorBodyTooLarge',VISION_NOT_CONFIGURED:'errorAiNotConfigured'};
      throw new Error(t(errorKeys[data.error] || 'errorGeneric',getLocale()));
    }
    if(response.headers.get('content-type')?.includes('text/event-stream')) {
      streamingMessage={role:'assistant',text:'',agent:null,collaboration:null,provider:state.provider,responseId:makeId(),category:classifyLearningTask(text),mode:learningMode};
      state.messages.push(streamingMessage); render(); scrollChat();
      const reader=response.body.getReader(), decoder=new TextDecoder();
      let buffer='';
      while(true) {
        const {value,done}=await reader.read();
        if(done) break;
        buffer+=decoder.decode(value,{stream:true});
        const events=buffer.split(/\r?\n\r?\n/); buffer=events.pop()||'';
        for(const raw of events) {
          const line=raw.split(/\r?\n/).find(part=>part.startsWith('data:'));
          if(!line) continue;
          let eventData; try{eventData=JSON.parse(line.slice(5).trim());}catch{continue;}
          if(eventData.type==='delta') {
            streamingMessage.text+=eventData.text||'';
            const targets=app.querySelectorAll('.msg.assistant:not([role="status"]) .message-content');
            const target=targets[targets.length-1];
            if(target) target.innerHTML=formatMessage(streamingMessage.text);
            scrollChat();
          } else if(eventData.type==='done') {
            streamingMessage.agent=eventData.agent||null;
            streamingMessage.collaboration=eventData.collaboration||null;
            streamingMessage.provider=eventData.provider||null;
            streamingMessage.model=eventData.model||null;
            streamingMessage.usage=eventData.usage||null;
            streamingMessage.sources=Array.isArray(eventData.sources)?eventData.sources:[];
            if(streamingMessage.sources.length){ streamingMessage.text += '\n\n' + (getLocale()==='fa'?'منابع گوگل:':'Google sources:') + '\n' + streamingMessage.sources.map((source,index)=>'['+(index+1)+'] '+source.title+' — '+source.url).join('\n'); const targets=app.querySelectorAll('.msg.assistant:not([role="status"]) .message-content'); const target=targets[targets.length-1]; if(target) target.innerHTML=formatMessage(streamingMessage.text); }
          } else if(eventData.type==='error') {
            const errorKeys={UPSTREAM_TIMEOUT:'errorUpstreamTimeout',UPSTREAM_ERROR:'errorUpstreamUnavailable',REQUEST_CANCELLED:'errorGeneric'};
            throw new Error(t(errorKeys[eventData.error]||'errorGeneric',getLocale()));
          }
        }
      }
      if(!streamingMessage.text.trim()) throw new Error(t('errorGeneric',getLocale()));
    } else {
      const data=await response.json().catch(()=>({}));
      state.messages.push({role:'assistant',text:data.reply || 'پاسخ خالی از سرویس دریافت شد.',agent:data.agent || null,collaboration:data.collaboration || null,provider:data.provider || null,responseId:makeId(),category:data.agent?.id || classifyLearningTask(text),mode:learningMode});
    }
  } catch(error) {
    if(streamingMessage && !streamingMessage.text.trim()) state.messages=state.messages.filter(message=>message!==streamingMessage);
    if(error?.name==='AbortError') state.messages.push({role:'assistant',text:getLocale()==='fa'?'پاسخ به درخواست شما متوقف شد.':(getLocale()==='de'?'Die Antwort wurde gestoppt.':(getLocale()==='fr'?'La réponse a été arrêtée.':'The response was stopped.'))});
    else state.messages.push({role:'assistant',text:error.message || t('errorGeneric',getLocale())});
  } finally { state.busy=false; state.requestController=null; saveCurrentConversation(); render(); scrollChat(); }
}

render();
