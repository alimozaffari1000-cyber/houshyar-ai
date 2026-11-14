const COPY = {
 fa:{title:'پنل مدیریت بازار',subtitle:'بررسی فروشگاه‌ها و آگهی‌های منتظر تأیید',stores:'فروشگاه‌های در انتظار',listings:'آگهی‌های در انتظار',approve:'تأیید',reject:'رد',empty:'موردی برای بررسی وجود ندارد.',denied:'این بخش فقط برای مدیران مجاز است.',error:'دریافت صف بررسی ممکن نشد.',done:'تصمیم ثبت شد.',failed:'ثبت تصمیم ناموفق بود.',country:'کشور بازار',loading:'در حال دریافت صف بررسی...'},
 en:{title:'Marketplace moderation',subtitle:'Review pending stores and listings',stores:'Pending stores',listings:'Pending listings',approve:'Approve',reject:'Reject',empty:'Nothing is waiting for review.',denied:'This area is restricted to administrators.',error:'Could not load the moderation queue.',done:'Decision saved.',failed:'Could not save the decision.',country:'Market country',loading:'Loading moderation queue...'},
 de:{title:'Marktplatz-Moderation',subtitle:'Ausstehende Shops und Anzeigen prüfen',stores:'Ausstehende Shops',listings:'Ausstehende Anzeigen',approve:'Genehmigen',reject:'Ablehnen',empty:'Keine Einträge zur Prüfung.',denied:'Dieser Bereich ist nur für Administratoren.',error:'Prüfliste konnte nicht geladen werden.',done:'Entscheidung gespeichert.',failed:'Entscheidung konnte nicht gespeichert werden.',country:'Marktland',loading:'Prüfliste wird geladen...'}
};
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function initMarketAdmin(app, getLocale) {
 const root=app.querySelector('#market-admin-root');
 if(!root)return;
 let country='IR';
 const locale=()=>COPY[getLocale()]?getLocale():'en';
 const load=async()=>{
  const t=COPY[locale()];
  root.innerHTML='<section class="market-admin-panel"><p>'+t.loading+'</p></section>';
  try{
   const response=await fetch('/api/market/moderate?country='+encodeURIComponent(country));
   const data=await response.json().catch(()=>({}));
   if(response.status===401||response.status===403){root.innerHTML='<section class="market-admin-panel market-admin-denied"><h2>'+t.title+'</h2><p>'+t.denied+'</p></section>';return;}
   if(!response.ok)throw new Error(data.error||'queue');
   const stores=Array.isArray(data.stores)?data.stores:[];
   const listings=Array.isArray(data.listings)?data.listings:[];
   const options=Object.entries({IR:'🇮🇷 ایران',AE:'🇦🇪 امارات',DE:'🇩🇪 آلمان',TR:'🇹🇷 ترکیه'}).map(([code,label])=>'<option value="'+code+'" '+(country===code?'selected':'')+'>'+label+'</option>').join('');
   const card=(item,type)=>'<article class="market-admin-item"><div><b>'+safe(type==='store'?item.name:item.title)+'</b><small>'+safe(item.city)+' · '+safe(item.country_code)+(type==='listing'?' · '+safe(item.store_name):'')+'</small><p>'+safe(type==='store'?item.description:item.description)+'</p></div><div class="market-admin-actions"><button type="button" data-type="'+type+'" data-id="'+safe(item.id)+'" data-decision="approve">'+t.approve+'</button><button type="button" class="danger" data-type="'+type+'" data-id="'+safe(item.id)+'" data-decision="reject">'+t.reject+'</button></div></article>';
   root.innerHTML='<section class="market-admin-panel"><div class="market-admin-heading"><div><h2>'+t.title+'</h2><p>'+t.subtitle+'</p></div><label>'+t.country+'<select id="market-admin-country">'+options+'</select></label></div><div class="market-admin-columns"><div><h3>'+t.stores+' ('+stores.length+')</h3>'+(stores.map(item=>card(item,'store')).join('')||'<p class="market-empty">'+t.empty+'</p>')+'</div><div><h3>'+t.listings+' ('+listings.length+')</h3>'+(listings.map(item=>card(item,'listing')).join('')||'<p class="market-empty">'+t.empty+'</p>')+'</div></div><p class="market-admin-feedback" aria-live="polite"></p></section>';
   root.querySelector('#market-admin-country').addEventListener('change',event=>{country=event.target.value;load();});
   root.querySelectorAll('[data-decision]').forEach(button=>button.addEventListener('click',async()=>{
    button.disabled=true;const feedback=root.querySelector('.market-admin-feedback');
    try{
     const result=await fetch('/api/market/moderate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:button.dataset.type,id:button.dataset.id,decision:button.dataset.decision,country})});
     const payload=await result.json().catch(()=>({}));
     if(!result.ok)throw new Error(payload.error||'moderation');
     feedback.textContent=t.done;await load();
    }catch{feedback.textContent=t.failed;button.disabled=false;}
   }));
  }catch{root.innerHTML='<section class="market-admin-panel"><h2>'+t.title+'</h2><p>'+t.error+'</p></section>';}
 };
 load();
}
