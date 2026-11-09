import './style.css';

const app = document.querySelector('#app');
const state = { messages: [], busy: false, draft: '' };
const escapeHTML = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function render() {
  app.innerHTML = `
    <header class="top"><div class="brand"><span class="logo">هـ</span><div><strong>هوش‌یار</strong><small>دستیار هوشمند چندمنظوره</small></div></div><span class="status"><i></i> نسخه آزمایشی</span></header>
    <main><section class="welcome"><span class="eyebrow">HOUSHYAR AI</span><h1>سلام، چطور می‌توانم<br><em>کمکت کنم؟</em></h1><p>سؤال بپرس، ایده‌پردازی کن، متن بنویس یا برای کارهایت برنامه‌ریزی کن.</p></section>
    <section class="suggestions">
      <button data-prompt="برای کسب‌وکارم چند ایده درآمدزایی پیشنهاد بده">💡 ایده‌پردازی <small>راه‌حل و پیشنهاد</small></button>
      <button data-prompt="این هفته برای یادگیری یک مهارت برنامه بده">📚 یادگیری <small>برنامه و آموزش</small></button>
      <button data-prompt="یک متن معرفی حرفه‌ای برای من بنویس">✍️ تولید محتوا <small>نوشتن و ویرایش</small></button>
      <button data-prompt="برای انجام کارهایم یک برنامه مرحله‌ای بساز">🧭 برنامه‌ریزی <small>قدم‌به‌قدم</small></button>
    </section>
    <section class="chat" aria-live="polite">${state.messages.map(m=>`<article class="msg ${m.role}"><b>${m.role==='user'?'شما':'هوش‌یار'}</b><p>${escapeHTML(m.text)}</p></article>`).join('')}${state.busy?'<article class="msg assistant"><b>هوش‌یار</b><p>در حال آماده‌سازی پاسخ…</p></article>':''}</section>
    <form id="chat-form"><textarea id="prompt" aria-label="پیام شما" rows="1" placeholder="پیامت را اینجا بنویس…" required>${escapeHTML(state.draft)}</textarea><button id="send" type="submit" ${state.busy?'disabled':''}>ارسال ↑</button></form>
    <p class="notice">این نسخه اولیه است. اتصال مدل هوش مصنوعی پس از تنظیم امن کلید سرویس فعال می‌شود؛ فعلاً اطلاعات محرمانه وارد نکن.</p></main>
    <footer>هوش‌یار AI · نسخه ۰.۶ آزمایشی</footer>`;
  app.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{const input=app.querySelector('#prompt');state.draft=b.dataset.prompt;input.value=state.draft;input.focus();}));
  const prompt=app.querySelector('#prompt');
  prompt.addEventListener('input',()=>{state.draft=prompt.value;});
  app.querySelector('#chat-form').addEventListener('submit',submitMessage);
}

async function submitMessage(event) {
  event.preventDefault();
  const input=app.querySelector('#prompt'); const text=input.value.trim();
  if(!text || state.busy) return;
  state.draft='';
  state.messages.push({role:'user',text});
  state.busy=true; render();
  try {
    const endpoint=import.meta.env.VITE_AI_ENDPOINT || '/api/chat';
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:state.messages.slice(-12)})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.message || 'پاسخ سرویس دریافت نشد ('+response.status+')');
    state.messages.push({role:'assistant',text:data.reply || data.message || 'پاسخ خالی از سرویس دریافت شد.'});
  } catch(error) {
    state.messages.push({role:'assistant',text:error.message || 'فعلاً امکان دریافت پاسخ وجود ندارد. لطفاً بعداً دوباره تلاش کن.'});
  } finally { state.busy=false; render(); }
}

render();
