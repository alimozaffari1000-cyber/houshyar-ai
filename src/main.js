import './style.css';
import { initAccountPanel } from './account.js';
import { initAuthFlows } from './auth-flows.js';
import { translate as t, getLocale, setLocale, localeOptions } from './i18n.js';

const app = document.querySelector('#app');
const state = { messages: [], busy: false, draft: '' };
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
    <header class="top"><div class="brand"><img class="logo" src="/brand/mark.svg" alt="نشان هوش‌یار" width="44" height="44"><div><strong>هوش‌یار</strong><small>${t('subtitle',locale)}</small></div></div><div class="top-actions"><select id="locale-select" class="locale-select" aria-label="زبان رابط">${localeOptions.map(item=>'<option value="'+item.code+'" '+(item.code===locale?'selected':'')+'>'+item.name+'</option>').join('')}</select><button id="account-open" type="button" class="account-open">${t('account',locale)}</button><span class="status"><i></i> ${t('beta',locale)}</span></div></header>
    <main><section class="welcome"><span class="eyebrow">HOUSHYAR AI</span><h1>${t('greeting',locale)}<br><em>${t('help',locale)}</em></h1><p>${t('intro',locale)}</p></section>
    <section class="suggestions" aria-label="${t('suggestionsLabel',locale)}">
      <button type="button" data-prompt="برای کسب‌وکارم چند ایده درآمدزایی پیشنهاد بده">💡 ${t('idea',locale)} <small>${t('ideaDesc',locale)}</small></button>
      <button type="button" data-prompt="این هفته برای یادگیری یک مهارت برنامه بده">📚 ${t('learning',locale)} <small>${t('learningDesc',locale)}</small></button>
      <button type="button" data-prompt="یک متن معرفی حرفه‌ای برای من بنویس">✍️ ${t('content',locale)} <small>${t('contentDesc',locale)}</small></button>
      <button type="button" data-prompt="برای انجام کارهایم یک برنامه مرحله‌ای بساز">🧭 ${t('planning',locale)} <small>${t('planningDesc',locale)}</small></button>
    </section>
    <div class="chat-tools"><span>${t('chat',locale)}</span><button id="clear-chat" type="button" ${state.messages.length || state.draft ? '' : 'disabled'}>${t('clear',locale)}</button></div>
    <section class="chat" aria-live="polite" aria-label="پیام‌های گفتگو">${state.messages.map((m,i)=>`<article class="msg ${m.role}"><div class="msg-head"><b>${m.role==='user'?t('you',locale):t('assistant',locale)}</b>${m.agent?'<small class="agent-label"> · '+escapeHTML(m.agent.label)+'</small>':''}${m.role==='assistant'?'<button type="button" class="copy-reply" data-index="'+i+'" aria-label="'+t('copy',locale)+'">'+t('copy',locale)+'</button>':''}</div><p>${escapeHTML(m.text)}</p></article>`).join('')}${state.busy?'<article class="msg assistant" role="status"><b>'+t('assistant',locale)+'</b><p>'+t('thinking',locale)+'</p></article>':''}</section>
    <form id="chat-form"><textarea id="prompt" aria-label="پیام شما" rows="1" maxlength="6000" placeholder="${t('placeholder',locale)}" required>${escapeHTML(state.draft)}</textarea><button id="send" type="submit" ${state.busy?'disabled':''}>${t('send',locale)}</button></form>
    <p class="input-hint">${t('hint',locale)}</p>
    <p class="notice">${t('notice',locale)}</p></main>
    <footer>${t('footer',locale)}</footer>`;
  app.querySelector('#locale-select').addEventListener('change', event => { setLocale(event.target.value); render(); });
  initAccountPanel(app);
  initAuthFlows(app);
  app.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{const input=app.querySelector('#prompt');state.draft=b.dataset.prompt;input.value=state.draft;input.focus();}));
  const prompt=app.querySelector('#prompt');
  const resize=()=>{prompt.style.height='auto';prompt.style.height=Math.min(prompt.scrollHeight,160)+'px';};
  prompt.addEventListener('input',()=>{state.draft=prompt.value;resize();});
  prompt.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();app.querySelector('#chat-form').requestSubmit();}});
  resize();
  app.querySelector('#chat-form').addEventListener('submit',submitMessage);
  app.querySelector('#clear-chat').addEventListener('click',()=>{if(state.busy)return;state.messages=[];state.draft='';render();});
  app.querySelectorAll('.copy-reply').forEach(button=>button.addEventListener('click',async()=>{const reply=state.messages[Number(button.dataset.index)]?.text;if(!reply)return;try{await navigator.clipboard.writeText(reply);button.textContent=t('copyDone',getLocale());}catch{button.textContent=t('copyFailed',getLocale());}}));
}

async function submitMessage(event) {
  event.preventDefault();
  const input=app.querySelector('#prompt'); const text=input.value.trim();
  if(!text || state.busy) return;
  state.draft='';
  state.messages.push({role:'user',text});
  state.busy=true; render(); scrollChat();
  try {
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:state.messages.slice(-11)})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) {
      const messages={AI_NOT_CONFIGURED:'سرویس هوش مصنوعی هنوز راه‌اندازی نشده است.',BODY_TOO_LARGE:'حجم درخواست بیش از حد مجاز است.',MESSAGE_TOO_LONG:'پیام بیش از حد طولانی است.',UPSTREAM_TIMEOUT:'پاسخ‌گویی بیش از حد طول کشید؛ دوباره تلاش کن.',UPSTREAM_ERROR:'سرویس هوش مصنوعی موقتاً پاسخ‌گو نیست.'};
      throw new Error(messages[data.error] || data.message || 'دریافت پاسخ ناموفق بود ('+response.status+').');
    }
    state.messages.push({role:'assistant',text:data.reply || 'پاسخ خالی از سرویس دریافت شد.',agent:data.agent || null});
  } catch(error) {
    state.messages.push({role:'assistant',text:error.message || 'فعلاً امکان دریافت پاسخ وجود ندارد. لطفاً بعداً دوباره تلاش کن.'});
  } finally { state.busy=false; render(); scrollChat(); }
}

render();
