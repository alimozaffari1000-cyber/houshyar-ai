import './style.css';
import { initAccountPanel } from './account.js';
import { initAuthFlows } from './auth-flows.js';

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
  app.innerHTML = `
    <header class="top"><div class="brand"><span class="logo">هـ</span><div><strong>هوش‌یار</strong><small>دستیار هوشمند چندمنظوره</small></div></div><div class="top-actions"><button id="account-open" type="button" class="account-open">حساب کاربری</button><span class="status"><i></i> نسخه آزمایشی</span></div></header>
    <main><section class="welcome"><span class="eyebrow">HOUSHYAR AI</span><h1>سلام، چطور می‌توانم<br><em>کمکت کنم؟</em></h1><p>سؤال بپرس، ایده‌پردازی کن، متن بنویس یا برای کارهایت برنامه‌ریزی کن.</p></section>
    <section class="suggestions" aria-label="پیشنهادهای شروع گفتگو">
      <button type="button" data-prompt="برای کسب‌وکارم چند ایده درآمدزایی پیشنهاد بده">💡 ایده‌پردازی <small>راه‌حل و پیشنهاد</small></button>
      <button type="button" data-prompt="این هفته برای یادگیری یک مهارت برنامه بده">📚 یادگیری <small>برنامه و آموزش</small></button>
      <button type="button" data-prompt="یک متن معرفی حرفه‌ای برای من بنویس">✍️ تولید محتوا <small>نوشتن و ویرایش</small></button>
      <button type="button" data-prompt="برای انجام کارهایم یک برنامه مرحله‌ای بساز">🧭 برنامه‌ریزی <small>قدم‌به‌قدم</small></button>
    </section>
    <div class="chat-tools"><span>گفتگو</span><button id="clear-chat" type="button" ${state.messages.length || state.draft ? '' : 'disabled'}>پاک‌کردن گفتگو</button></div>
    <section class="chat" aria-live="polite" aria-label="پیام‌های گفتگو">${state.messages.map((m,i)=>`<article class="msg ${m.role}"><div class="msg-head"><b>${m.role==='user'?'شما':'هوش‌یار'}</b>${m.role==='assistant'?'<button type="button" class="copy-reply" data-index="'+i+'" aria-label="کپی پاسخ">کپی</button>':''}</div><p>${escapeHTML(m.text)}</p></article>`).join('')}${state.busy?'<article class="msg assistant" role="status"><b>هوش‌یار</b><p>در حال آماده‌سازی پاسخ…</p></article>':''}</section>
    <form id="chat-form"><textarea id="prompt" aria-label="پیام شما" rows="1" maxlength="6000" placeholder="پیامت را اینجا بنویس…" required>${escapeHTML(state.draft)}</textarea><button id="send" type="submit" ${state.busy?'disabled':''}>ارسال ↑</button></form>
    <p class="input-hint">Enter برای ارسال · Shift + Enter برای رفتن به خط بعد</p>
    <p class="notice">نسخه آزمایشی: گفتگو فقط تا زمان باز بودن این صفحه در حافظه موقت مرورگر نگه داشته می‌شود. اطلاعات محرمانه، رمز عبور یا کلید بانکی ارسال نکن.</p></main>
    <footer>هوش‌یار AI · نسخه آزمایشی</footer>`;
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
  app.querySelectorAll('.copy-reply').forEach(button=>button.addEventListener('click',async()=>{const reply=state.messages[Number(button.dataset.index)]?.text;if(!reply)return;try{await navigator.clipboard.writeText(reply);button.textContent='کپی شد';}catch{button.textContent='کپی نشد';}}));
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
    state.messages.push({role:'assistant',text:data.reply || 'پاسخ خالی از سرویس دریافت شد.'});
  } catch(error) {
    state.messages.push({role:'assistant',text:error.message || 'فعلاً امکان دریافت پاسخ وجود ندارد. لطفاً بعداً دوباره تلاش کن.'});
  } finally { state.busy=false; render(); scrollChat(); }
}

render();
