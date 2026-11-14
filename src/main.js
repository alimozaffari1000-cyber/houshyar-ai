import './style.css';
import { initAccountPanel } from './account.js';
import { initAuthFlows } from './auth-flows.js';
import { translate as t, getLocale, setLocale, localeOptions } from './i18n.js';
import { initWorkspace } from './workspace.js';
import { classifyLearningTask, recommendLearningMode } from './learning-core.js';
import { attachLearningFeedback } from './learning-ui.js';

const app = document.querySelector('#app');
const RESPONSE_MODE_LABELS = {"fa":["سریع","متعادل","تحلیلی عمیق","خلاق"],"en":["Fast","Balanced","Deep reasoning","Creative"],"de":["Schnell","Ausgewogen","Tiefgehend","Kreativ"],"ar":["سريع","متوازن","استدلال عميق","إبداعي"],"tr":["Hızlı","Dengeli","Derin düşünme","Yaratıcı"],"es":["Rápido","Equilibrado","Razonamiento profundo","Creativo"],"fr":["Rapide","Équilibré","Raisonnement approfondi","Créatif"],"ru":["Быстрый","Сбалансированный","Глубокий анализ","Творческий"],"zh":["快速","均衡","深度推理","创意"],"hi":["तेज़","संतुलित","गहन तर्क","रचनात्मक"],"ur":["تیز","متوازن","گہری سوچ","تخلیقی"],"pt":["Rápido","Equilibrado","Raciocínio profundo","Criativo"]};
const COMPARE_LABELS = {"fa":"مقایسه دو مدل (مصرف بیشتر)","en":"Compare two models (higher usage)","de":"Zwei Modelle vergleichen (mehr Verbrauch)","ar":"مقارنة نموذجين (استهلاك أعلى)","tr":"İki modeli karşılaştır (daha fazla kullanım)","es":"Comparar dos modelos (mayor consumo)","fr":"Comparer deux modèles (consommation accrue)","ru":"Сравнить две модели (больше затрат)","zh":"比较两个模型（消耗更多）","hi":"दो मॉडल तुलना करें (अधिक उपयोग)","ur":"دو ماڈلز کا موازنہ (زیادہ استعمال)","pt":"Comparar dois modelos (maior consumo)"};
const RESPONSE_MODE_TITLES = {"fa":"حالت پاسخ","en":"Response mode","de":"Antwortmodus","ar":"وضع الاستجابة","tr":"Yanıt modu","es":"Modo de respuesta","fr":"Mode de réponse","ru":"Режим ответа","zh":"回答模式","hi":"उत्तर मोड","ur":"جواب کا انداز","pt":"Modo de resposta"};
const state = { messages: [], busy: false, draft: '', mode: 'auto', compare: false, provider: 'auto' };
const AUTO_MODE_LABELS = { fa: 'یادگیری خودکار', en: 'Adaptive auto', de: 'Adaptiv automatisch', ar: 'تلقائي متكيف', tr: 'Uyarlanabilir otomatik', es: 'Automático adaptativo', fr: 'Automatique adaptatif', ru: 'Адаптивный авто', zh: '自适应自动', hi: 'अनुकूली ऑटो', ur: 'خودکار موافق', pt: 'Automático adaptativo' };
const escapeHTML = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    <main><section class="welcome"><span class="eyebrow">HOUSHYAR AI</span><h1>${t('greeting',locale)}<br><em>${t('help',locale)}</em></h1><p>${t('intro',locale)}</p></section>
    <section class="toolbox" aria-labelledby="toolbox-title"><div class="toolbox-heading"><h2 id="toolbox-title">${t('toolboxTitle',locale)}</h2><p>${t('toolboxDesc',locale)}</p></div><div class="toolbox-grid">
      <button type="button" data-prompt="${escapeHTML(t('toolResearchPrompt',locale))}"><span>⌕</span><b>${t('toolResearch',locale)}</b></button>
      <button type="button" data-prompt="${escapeHTML(t('toolBusinessPrompt',locale))}"><span>↗</span><b>${t('toolBusiness',locale)}</b></button>
      <button type="button" data-prompt="${escapeHTML(t('toolCodingPrompt',locale))}"><span>{ }</span><b>${t('toolCoding',locale)}</b></button>
      <button type="button" data-prompt="${escapeHTML(t('toolTranslatePrompt',locale))}"><span>文</span><b>${t('toolTranslate',locale)}</b></button>
      <button type="button" data-prompt="${escapeHTML(t('toolImagePrompt',locale))}"><span>✧</span><b>${t('toolImage',locale)}</b></button>
      <button type="button" data-prompt="${escapeHTML(t('toolStudyPrompt',locale))}"><span>◎</span><b>${t('toolStudy',locale)}</b></button>
    </div></section>
    <section class="suggestions" aria-label="${t('suggestionsLabel',locale)}">
      <button type="button" data-prompt="${escapeHTML(t('promptIdea',locale))}">💡 ${t('idea',locale)} <small>${t('ideaDesc',locale)}</small></button>
      <button type="button" data-prompt="${escapeHTML(t('promptLearning',locale))}">📚 ${t('learning',locale)} <small>${t('learningDesc',locale)}</small></button>
      <button type="button" data-prompt="${escapeHTML(t('promptContent',locale))}">✍️ ${t('content',locale)} <small>${t('contentDesc',locale)}</small></button>
      <button type="button" data-prompt="${escapeHTML(t('promptPlanning',locale))}">🧭 ${t('planning',locale)} <small>${t('planningDesc',locale)}</small></button>
    </section>
    <div class="chat-tools"><span>${t('chat',locale)}</span><button id="clear-chat" type="button" ${state.messages.length || state.draft ? '' : 'disabled'}>${t('clear',locale)}</button></div>
    <section class="chat" aria-live="polite" aria-label="${t('chatMessagesLabel',locale)}">${state.messages.map((m,i)=>`<article class="msg ${m.role}"><div class="msg-head"><b>${m.role==='user'?t('you',locale):t('assistant',locale)}</b>${m.agent?'<small class="agent-label"> · '+escapeHTML(m.agent.label)+'</small>':''}${m.role==='assistant'?'<button type="button" class="copy-reply" data-index="'+i+'" aria-label="'+t('copy',locale)+'">'+t('copy',locale)+'</button>':''}</div><p>${escapeHTML(m.text)}</p></article>`).join('')}${state.busy?'<article class="msg assistant" role="status"><b>'+t('assistant',locale)+'</b><p>'+t('thinking',locale)+'</p></article>':''}</section>
    <div class="mode-control"><label for="ai-provider">موتور هوش مصنوعی</label><select id="ai-provider" aria-label="AI provider"><option value="auto" ${state.provider==='auto'?'selected':''}>انتخاب خودکار</option><option value="groq" ${state.provider==='groq'?'selected':''}>Groq</option><option value="anthropic" ${state.provider==='anthropic'?'selected':''}>Claude (Anthropic)</option></select><label class="compare-toggle"><input id="compare-models" type="checkbox" ${state.compare ? "checked" : ""}> ${COMPARE_LABELS[locale] || COMPARE_LABELS.en}</label><label for="response-mode">${RESPONSE_MODE_TITLES[locale] || "Response mode"}</label><select id="response-mode" aria-label="Response mode">${["auto","fast","balanced","deep","creative"].map((mode,i)=>'<option value="'+mode+'" '+(state.mode===mode?'selected':'')+'>'+(mode === 'auto' ? (AUTO_MODE_LABELS[locale] || AUTO_MODE_LABELS.en) : RESPONSE_MODE_LABELS[locale][i-1])+'</option>').join('')}</select></div>\n    <form id="chat-form"><textarea id="prompt" aria-label="${t('messageInputLabel',locale)}" rows="1" maxlength="6000" placeholder="${t('placeholder',locale)}" required>${escapeHTML(state.draft)}</textarea><button id="send" type="submit" ${state.busy?'disabled':''}>${t('send',locale)}</button></form>
    <p class="input-hint">${t('hint',locale)}</p>
    <p class="notice">${t('notice',locale)}</p></main>
    <footer>${t('footer',locale)}</footer>`;
  attachLearningFeedback(app.querySelector('.chat'), state.messages, locale);
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
  app.querySelector('#ai-provider').addEventListener('change', event => { state.provider = ['auto','groq','anthropic'].includes(event.target.value) ? event.target.value : 'auto'; });
  app.querySelector('#chat-form').addEventListener('submit',submitMessage);
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
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:state.messages.slice(-11),mode:learningMode,compare:state.compare,provider:state.provider})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) {
      const errorKeys={AI_NOT_CONFIGURED:'errorAiNotConfigured',BODY_TOO_LARGE:'errorBodyTooLarge',MESSAGE_TOO_LONG:'errorMessageTooLong',UPSTREAM_TIMEOUT:'errorUpstreamTimeout',UPSTREAM_ERROR:'errorUpstreamUnavailable',UPSTREAM_UNAVAILABLE:'errorUpstreamUnavailable',COMPARE_NOT_CONFIGURED:'errorAiNotConfigured',PROVIDER_NOT_CONFIGURED:'errorAiNotConfigured',COMPARISON_FAILED:'errorUpstreamUnavailable'};
      throw new Error(t(errorKeys[data.error] || 'errorGeneric',getLocale()));
    }
    state.messages.push({role:'assistant',text:data.reply || 'پاسخ خالی از سرویس دریافت شد.',agent:data.agent || null,provider:data.provider || null,responseId:crypto.randomUUID(),category:data.agent?.id || classifyLearningTask(text),mode:learningMode});
  } catch(error) {
    state.messages.push({role:'assistant',text:error.message || t('errorGeneric',getLocale())});
  } finally { state.busy=false; render(); scrollChat(); }
}

render();
