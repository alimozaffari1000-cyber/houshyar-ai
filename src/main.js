import './style.css';
import { initAccountPanel } from './account.js';
import { initAuthFlows } from './auth-flows.js';
import { initAdPlacement } from './ad-placement.js';
import { initDrawPanel } from './draw-panel.js';
import { translate as t, getLocale, setLocale, localeOptions } from './i18n.js';

const app = document.querySelector('#app');
const state = { messages: [], busy: false, draft: '', conversationId: null, projectId: null, projectTitle: '', historyNotice: '' };
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
    <header class="top"><div class="brand"><span class="logo">هـ</span><div><strong>هوش‌یار</strong><small>${t('subtitle',locale)}</small></div></div><div class="top-actions"><select id="locale-select" class="locale-select" aria-label="زبان رابط">${localeOptions.map(item=>'<option value="'+item.code+'" '+(item.code===locale?'selected':'')+'>'+item.name+'</option>').join('')}</select><button id="account-open" type="button" class="account-open">${t('account',locale)}</button><span class="status"><i></i> ${t('beta',locale)}</span></div></header>
    <main><section class="welcome"><span class="eyebrow">HOUSHYAR AI</span><h1>${t('greeting',locale)}<br><em>${t('help',locale)}</em></h1><p>${t('intro',locale)}</p></section>
    <section class="suggestions" aria-label="پیشنهادهای شروع گفتگو">
      <button type="button" data-prompt="برای کسب‌وکارم چند ایده درآمدزایی پیشنهاد بده">💡 ایده‌پردازی <small>راه‌حل و پیشنهاد</small></button>
      <button type="button" data-prompt="این هفته برای یادگیری یک مهارت برنامه بده">📚 یادگیری <small>برنامه و آموزش</small></button>
      <button type="button" data-prompt="یک متن معرفی حرفه‌ای برای من بنویس">✍️ تولید محتوا <small>نوشتن و ویرایش</small></button>
      <button type="button" data-prompt="برای انجام کارهایم یک برنامه مرحله‌ای بساز">🧭 برنامه‌ریزی <small>قدم‌به‌قدم</small></button>
    </section>
    <section class="service-catalog" aria-labelledby="service-title">
      <div class="service-heading"><div><span class="eyebrow">خدمات هوش‌یار</span><h2 id="service-title">برای چه کاری کمک می‌خواهی؟</h2><p>یک حوزه را انتخاب کن تا درخواست مناسب برایت آماده شود.</p></div><label class="service-search"><span class="sr-only">جست‌وجوی خدمات</span><input id="service-search" type="search" placeholder="جست‌وجوی خدمات…" autocomplete="off"></label></div>
      <div class="service-grid" id="service-grid">
        <button class="service-card" type="button" data-service="general" data-title="دستیار عمومی" data-prompt="در نقش دستیار عمومی هوش‌یار، به این درخواست من پاسخ بده: "><span class="service-icon">✦</span><strong>دستیار عمومی</strong><small>پاسخ به پرسش‌ها، توضیح مفاهیم و حل مسائل روزمره</small><span class="service-action">شروع گفتگو ←</span></button>
        <button class="service-card" type="button" data-service="research" data-title="تحقیق و بررسی" data-prompt="این موضوع را دقیق بررسی کن؛ واقعیت‌ها، منابع، تاریخ اطلاعات و موارد نامطمئن را جدا کن: "><span class="service-icon">⌕</span><strong>تحقیق و بررسی</strong><small>بررسی موضوعات، مقایسه گزینه‌ها و خلاصه‌سازی اطلاعات</small><span class="service-action">شروع تحقیق ←</span></button>
        <button class="service-card" type="button" data-service="writing" data-title="تولید محتوا" data-prompt="برای این موضوع محتوای باکیفیت و قابل استفاده تولید کن: "><span class="service-icon">✎</span><strong>تولید محتوا</strong><small>نوشتن، بازنویسی، تبلیغات و ایده برای شبکه‌های اجتماعی</small><span class="service-action">ساخت محتوا ←</span></button>
        <button class="service-card" type="button" data-service="translation" data-title="ترجمه و زبان" data-prompt="این متن را ترجمه و از نظر لحن و روانی ویرایش کن. زبان مقصد را در صورت نیاز از من بپرس: "><span class="service-icon">文</span><strong>ترجمه و زبان</strong><small>ترجمه، اصلاح متن و بومی‌سازی چندزبانه</small><span class="service-action">شروع ترجمه ←</span></button>
        <button class="service-card" type="button" data-service="learning" data-title="آموزش و یادگیری" data-prompt="این موضوع را متناسب با سطح مبتدی به من آموزش بده و تمرین مرحله‌ای طراحی کن: "><span class="service-icon">▤</span><strong>آموزش و یادگیری</strong><small>یادگیری مهارت، برنامه درسی و تمرین هدفمند</small><span class="service-action">شروع یادگیری ←</span></button>
        <button class="service-card" type="button" data-service="business" data-title="کسب‌وکار و بازاریابی" data-prompt="برای این کسب‌وکار یک تحلیل عملی شامل مشتری هدف، رقبا، هزینه‌ها، ریسک‌ها و اقدامات اولویت‌دار تهیه کن: "><span class="service-icon">▥</span><strong>کسب‌وکار و بازاریابی</strong><small>ایده‌پردازی، فروش، بازاریابی و برنامه رشد</small><span class="service-action">بررسی کسب‌وکار ←</span></button>
        <button class="service-card" type="button" data-service="analysis" data-title="تحلیل داده و مالی" data-prompt="این مسئله را با ذکر فرض‌ها، روش محاسبه، سناریوها و ریسک‌ها تحلیل کن: "><span class="service-icon">▧</span><strong>تحلیل داده و مالی</strong><small>محاسبات، مقایسه و تحلیل سناریو با بیان محدودیت‌ها</small><span class="service-action">شروع تحلیل ←</span></button>
        <button class="service-card" type="button" data-service="coding" data-title="برنامه‌نویسی" data-prompt="در نقش دستیار برنامه‌نویسی، مسئله را تحلیل کن و راه‌حل قابل تست ارائه بده: "><span class="service-icon">⌘</span><strong>برنامه‌نویسی</strong><small>توضیح کد، طراحی، رفع خطا و نوشتن تست</small><span class="service-action">شروع توسعه ←</span></button>
        <button class="service-card" type="button" data-service="planning" data-title="برنامه‌ریزی و مدیریت کار" data-prompt="این هدف را به مراحل اجرایی، زمان‌بندی، وابستگی‌ها و معیار موفقیت تبدیل کن: "><span class="service-icon">◷</span><strong>برنامه‌ریزی و مدیریت کار</strong><small>تبدیل هدف به برنامه قابل پیگیری و اولویت‌بندی‌شده</small><span class="service-action">ساخت برنامه ←</span></button>
      </div>
      <p class="service-disclaimer">این دسته‌بندی‌ها مسیر شروع درخواست هستند؛ دسترسی به جست‌وجوی زنده، ابزارهای تخصصی و خروجی فایل به فعال بودن سرویس مربوط وابسته است.</p>
    </section>
    <div id="home-ad-slot"></div>
    <div id="draw-panel-mount"></div>
    <div class="chat-tools"><span>${t('chat',locale)}${state.projectId ? ' · پروژه: ' + escapeHTML(state.projectTitle || "انتخاب‌شده") : ''}</span><button id="clear-chat" type="button" ${state.messages.length || state.draft ? '' : 'disabled'}>${t('clear',locale)}</button></div><p id="history-status" class="history-status" role="status" aria-live="polite">${escapeHTML(state.historyNotice)}</p>
    <section class="chat" aria-live="polite" aria-label="پیام‌های گفتگو">${state.messages.map((m,i)=>`<article class="msg ${m.role}"><div class="msg-head"><b>${m.role==='user'?'شما':'هوش‌یار'}</b>${m.agent?'<small class="agent-label"> · '+escapeHTML(m.agent.label)+'</small>':''}${m.role==='assistant'?'<button type="button" class="copy-reply" data-index="'+i+'" aria-label="کپی پاسخ">کپی</button>':''}</div><p>${escapeHTML(m.text)}</p></article>`).join('')}${state.busy?'<article class="msg assistant" role="status"><b>هوش‌یار</b><p>در حال آماده‌سازی پاسخ…</p></article>':''}</section>
    <form id="chat-form"><textarea id="prompt" aria-label="پیام شما" rows="1" maxlength="6000" placeholder="${t('placeholder',locale)}" required>${escapeHTML(state.draft)}</textarea><button id="send" type="submit" ${state.busy?'disabled':''}>${t('send',locale)}</button></form>
    <p class="input-hint">${t('hint',locale)}</p>
    <p class="notice">${t('notice',locale)}</p></main>
    <footer>هوش‌یار AI · نسخه آزمایشی</footer>`;
  app.querySelector('#locale-select').addEventListener('change', event => { setLocale(event.target.value); render(); });
  initAccountPanel(app);
  initAuthFlows(app);
  initAdPlacement(app.querySelector('#home-ad-slot'));
  initDrawPanel(app);
  app.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{const input=app.querySelector('#prompt');state.draft=b.dataset.prompt;input.value=state.draft;input.focus();}));
  const serviceSearch=app.querySelector('#service-search');
  serviceSearch?.addEventListener('input',()=>{
    const query=serviceSearch.value.trim().toLocaleLowerCase();
    app.querySelectorAll('.service-card').forEach(card=>{
      const searchable=(card.dataset.title+' '+card.textContent).toLocaleLowerCase();
      card.hidden=Boolean(query && !searchable.includes(query));
    });
  });
  const prompt=app.querySelector('#prompt');
  const resize=()=>{prompt.style.height='auto';prompt.style.height=Math.min(prompt.scrollHeight,160)+'px';};
  prompt.addEventListener('input',()=>{state.draft=prompt.value;resize();});
  prompt.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();app.querySelector('#chat-form').requestSubmit();}});
  resize();
  app.querySelector('#chat-form').addEventListener('submit',submitMessage);
  app.querySelector('#clear-chat').addEventListener('click',()=>{if(state.busy)return;state.messages=[];state.draft='';state.conversationId=null;state.projectId=null;state.projectTitle='';state.historyNotice='گفتگوی تازه شروع شد؛ برای ذخیره تاریخچه باید وارد حساب شوید.';render();});
  app.querySelectorAll('.copy-reply').forEach(button=>button.addEventListener('click',async()=>{const reply=state.messages[Number(button.dataset.index)]?.text;if(!reply)return;try{await navigator.clipboard.writeText(reply);button.textContent='کپی شد';}catch{button.textContent='کپی نشد';}}));
}

async function persistConversation() {
  if (state.messages.length < 2 || state.messages[state.messages.length - 1]?.role !== 'assistant') return;
  const isNew = !state.conversationId;
  const url = isNew ? '/api/conversations' : '/api/conversations/' + encodeURIComponent(state.conversationId);
  try {
    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: state.messages.map(item => ({ role: item.role, text: item.text })), project_id: state.projectId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && !isNew && response.status === 404) {
      state.conversationId = null;
      return persistConversation();
    }
    if (!response.ok) {
      state.historyNotice = data.error === 'AUTH_REQUIRED'
        ? 'برای ذخیره و بازیابی گفتگوها وارد حساب کاربری شوید.'
        : data.error === 'HISTORY_NOT_CONFIGURED'
          ? 'ذخیره تاریخچه هنوز روی سرور فعال نشده است.'
          : data.message || 'ذخیره تاریخچه انجام نشد.';
      return;
    }
    state.conversationId = data.conversation?.id || state.conversationId;
    state.historyNotice = 'گفتگو در حساب کاربری ذخیره شد.';
  } catch {
    state.historyNotice = 'ارتباط با سامانه ذخیره تاریخچه برقرار نشد؛ گفتگو فعلاً فقط در همین صفحه باقی می‌ماند.';
  }
}

window.addEventListener('houshyar:conversation-deleted', event => {
  if (state.conversationId !== event.detail?.id) return;
  state.conversationId = null;
  state.projectId = null;
  state.projectTitle = '';
  state.historyNotice = 'گفتگو حذف شد؛ ادامه آن در صورت ارسال پیام به‌عنوان گفتگوی تازه ذخیره می‌شود.';
});

window.addEventListener('houshyar:new-conversation', () => {
  if (state.busy) return;
  state.messages = [];
  state.conversationId = null;
  state.projectId = null;
  state.projectTitle = '';
  state.draft = '';
  state.historyNotice = 'گفتگوی تازه آماده است.';
  render();
  app.querySelector('#prompt')?.focus();
});


window.addEventListener('houshyar:project-selected', async event => {
  const project = event.detail;
  if (!project?.id) return;
  state.projectId = project.id;
  state.projectTitle = project.title || 'پروژه انتخاب‌شده';
  state.historyNotice = 'پروژه «' + state.projectTitle + '» برای گفتگوی جاری انتخاب شد.';
  if (state.conversationId) {
    try {
      const response = await fetch('/api/conversations/' + encodeURIComponent(state.conversationId), {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: state.projectId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'اتصال گفتگو به پروژه انجام نشد.');
      state.historyNotice = 'گفتگو به پروژه «' + state.projectTitle + '» متصل شد.';
    } catch (error) { state.historyNotice = error.message; }
  }
  render();
});

window.addEventListener('houshyar:project-deleted', event => {
  if (state.projectId !== event.detail?.id) return;
  state.projectId = null;
  state.projectTitle = '';
  state.historyNotice = 'پروژه حذف شد؛ گفتگوهای قبلی بدون حذف شدن از پروژه جدا شدند.';
  render();
});

window.addEventListener('houshyar:load-conversation', event => {
  const conversation = event.detail;
  if (!conversation || !Array.isArray(conversation.messages)) return;
  state.messages = conversation.messages.map(item => ({ role: item.role, text: item.content, agent: null }));
  state.conversationId = conversation.id || null;
  state.projectId = conversation.project_id || null;
  state.projectTitle = state.projectId ? 'پروژه انتخاب‌شده' : '';
  state.draft = '';
  state.historyNotice = 'گفتگوی ذخیره‌شده بارگذاری شد.';
  render();
  scrollChat();
});

async function submitMessage(event) {
  event.preventDefault();
  const input=app.querySelector('#prompt'); const text=input.value.trim();
  if(!text || state.busy) return;
  state.draft='';
  if (state.messages.length > 78) state.messages.splice(0, 2);
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
    await persistConversation();
  } catch(error) {
    state.messages.push({role:'assistant',text:error.message || 'فعلاً امکان دریافت پاسخ وجود ندارد. لطفاً بعداً دوباره تلاش کن.'});
  } finally { state.busy=false; render(); scrollChat(); }
}

render();
