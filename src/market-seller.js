const CATEGORIES = ['goods','property','vehicles','jobs','services','fashion'];
const TEXT = {
 fa:{title:'پنل فروشنده هوش‌یار',intro:'فروشگاه خود را ثبت کنید و کالاها یا خدماتتان را در بازار کشور انتخاب‌شده عرضه کنید.',login:'برای ساخت فروشگاه ابتدا وارد حساب خود شوید.',loginBtn:'ورود / ثبت‌نام',create:'ساخت فروشگاه',name:'نام فروشگاه',slug:'شناسه انگلیسی فروشگاه؛ مانند my-shop',city:'شهر',about:'توضیحات فروشگاه',send:'ارسال فروشگاه برای بررسی',mine:'فروشگاه‌های من',none:'هنوز فروشگاهی ثبت نکرده‌اید.',pending:'در انتظار بررسی',active:'فعال',rejected:'رد شده',suspended:'تعلیق‌شده',newListing:'ثبت آگهی جدید',chooseStore:'انتخاب فروشگاه',category:'دسته‌بندی',titleField:'عنوان آگهی',details:'توضیحات کالا یا خدمت (حداقل ۱۰ نویسه)',price:'قیمت به واحد پول محلی (اختیاری)',sendListing:'ارسال آگهی برای بررسی',storeOk:'فروشگاه برای بررسی ارسال شد.',listingOk:'آگهی برای بررسی ارسال شد.',failed:'ثبت انجام نشد. اطلاعات و وضعیت ورود را بررسی کنید.',unavailable:'پنل فروشنده در دسترس نیست؛ اتصال پایگاه داده را بررسی کنید.',country:'کشور بازار',offer:'ارائه کالا یا خدمت'},
 en:{title:'Houshyar seller workspace',intro:'Create a store and offer products or services in the selected country market.',login:'Sign in before creating a store.',loginBtn:'Sign in / Register',create:'Create a store',name:'Store name',slug:'Store URL slug, e.g. my-shop',city:'City',about:'Store description',send:'Submit store for review',mine:'My stores',none:'You have not created a store yet.',pending:'Pending review',active:'Active',rejected:'Rejected',suspended:'Suspended',newListing:'Create a listing',chooseStore:'Select store',category:'Category',titleField:'Listing title',details:'Product or service details (at least 10 characters)',price:'Price in local currency (optional)',sendListing:'Submit listing for review',storeOk:'Store submitted for review.',listingOk:'Listing submitted for review.',failed:'Submission failed. Check the details and sign-in status.',unavailable:'Seller workspace unavailable. Check the database connection.',country:'Market country',offer:'Offer'},
 de:{title:'Houshyar-Verkäuferbereich',intro:'Erstellen Sie einen Shop und bieten Sie Produkte oder Dienstleistungen im ausgewählten Landesmarkt an.',login:'Bitte melden Sie sich zuerst an.',loginBtn:'Anmelden / Registrieren',create:'Shop erstellen',name:'Shopname',slug:'Shop-URL-Kennung, z. B. mein-shop',city:'Stadt',about:'Shopbeschreibung',send:'Shop zur Prüfung senden',mine:'Meine Shops',none:'Sie haben noch keinen Shop erstellt.',pending:'Wird geprüft',active:'Aktiv',rejected:'Abgelehnt',suspended:'Gesperrt',newListing:'Anzeige erstellen',chooseStore:'Shop auswählen',category:'Kategorie',titleField:'Anzeigentitel',details:'Produkt- oder Dienstleistungsdetails (mindestens 10 Zeichen)',price:'Preis in Landeswährung (optional)',sendListing:'Anzeige zur Prüfung senden',storeOk:'Shop wurde zur Prüfung eingereicht.',listingOk:'Anzeige wurde zur Prüfung eingereicht.',failed:'Senden fehlgeschlagen. Angaben und Anmeldung prüfen.',unavailable:'Verkäuferbereich nicht verfügbar. Datenbankverbindung prüfen.',country:'Marktland',offer:'Angebot'}
};
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function initMarketSeller(app, getLocale) {
 const root = app.querySelector('#market-seller-root');
 if (!root) return;
 const locale = () => ['fa','en','de'].includes(getLocale()) ? getLocale() : 'en';
 let stores = [], selectedCountry = 'IR';
 const countrySelect = () => app.querySelector('#market-country');
 const categoryNames = {fa:['کالا و پوشاک','ملک','خودرو','استخدام','خدمات','مد و پوشاک'],en:['Goods & fashion','Property','Vehicles','Jobs','Services','Fashion'],de:['Waren & Mode','Immobilien','Fahrzeuge','Jobs','Dienstleistungen','Mode']};
 app.querySelector('#market-country')?.addEventListener('change',e=>{selectedCountry=e.target.value;const picker=root.querySelector('#seller-country');if(picker)picker.value=selectedCountry;});
 const statusText = (status,t) => t[status] || status;
 const render = async () => {
  const lang=locale(), t=TEXT[lang];
  selectedCountry=countrySelect()?.value || selectedCountry;
  root.innerHTML='<section class="market-seller-panel"><p class="market-loading">'+(lang==='fa'?'در حال دریافت پنل فروشنده...':'Loading seller workspace...')+'</p></section>';
  try {
   const response=await fetch('/api/market/my-stores');
   if(response.status===401){
    root.innerHTML='<section class="market-seller-panel"><div class="market-seller-heading"><div><h2>'+t.title+'</h2><p>'+t.login+'</p></div><button type="button" class="market-seller-login">'+t.loginBtn+'</button></div></section>';
    root.querySelector('.market-seller-login').addEventListener('click',()=>app.querySelector('#account-open')?.click());
    return;
   }
   if(!response.ok) throw new Error('seller api');
   const data=await response.json(); stores=Array.isArray(data.stores)?data.stores:[];
   const eligible=stores.filter(s=>['pending','active'].includes(s.status));
   const marketOptions=Object.entries({IR:'🇮🇷 ایران',AE:'🇦🇪 امارات',DE:'🇩🇪 آلمان',TR:'🇹🇷 ترکیه'}).map(([code,name])=>'<option value="'+code+'" '+(selectedCountry===code?'selected':'')+'>'+name+'</option>').join('');
   const storeOptions=eligible.map(s=>'<option value="'+safe(s.id)+'">'+safe(s.name)+' — '+statusText(s.status,t)+'</option>').join('');
   root.innerHTML='<section class="market-seller-panel"><div class="market-seller-heading"><div><span class="country-market-kicker">HOUSHYAR SELLER</span><h2>'+t.title+'</h2><p>'+t.intro+'</p></div><label>'+t.country+'<select id="seller-country">'+marketOptions+'</select></label></div><div class="market-seller-grid"><form id="seller-store-form" class="market-seller-form"><h3>'+t.create+'</h3><input name="name" minlength="2" maxlength="100" required placeholder="'+t.name+'"><input name="slug" minlength="2" maxlength="80" pattern="[a-z0-9-]+" required placeholder="'+t.slug+'"><input name="city" minlength="2" maxlength="100" required placeholder="'+t.city+'"><textarea name="description" maxlength="1200" placeholder="'+t.about+'"></textarea><button type="submit">'+t.send+'</button><p class="market-seller-feedback" aria-live="polite"></p></form><div class="market-seller-stores"><h3>'+t.mine+'</h3>'+(stores.length?stores.map(s=>'<article class="market-seller-store"><b>'+safe(s.name)+'</b><span class="market-status '+safe(s.status)+'">'+statusText(s.status,t)+'</span><small>'+safe(s.city)+' · '+safe(s.country_code)+'</small></article>').join(''):'<p class="market-empty">'+t.none+'</p>')+'</div></div>'+(storeOptions?'<form id="seller-listing-form" class="market-seller-form market-seller-listing"><h3>'+t.newListing+'</h3><select name="storeId" required><option value="">'+t.chooseStore+'</option>'+storeOptions+'</select><select name="category" required><option value="">'+t.category+'</option>'+CATEGORIES.map((key,i)=>'<option value="'+key+'">'+categoryNames[lang][i]+'</option>').join('')+'</select><input name="title" minlength="4" maxlength="120" required placeholder="'+t.titleField+'"><textarea name="description" minlength="10" maxlength="3000" required placeholder="'+t.details+'"></textarea><input name="city" minlength="2" maxlength="100" required placeholder="'+t.city+'"><input name="price" type="number" min="0" step="1" placeholder="'+t.price+'"><button type="submit">'+t.sendListing+'</button><p class="market-seller-feedback" aria-live="polite"></p></form>':'')+'</section>';
   root.querySelector('#seller-country').addEventListener('change',e=>{selectedCountry=e.target.value;});
   root.querySelector('#seller-store-form').addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,fd=new FormData(form),button=form.querySelector('button'),feedback=form.querySelector('.market-seller-feedback');
    button.disabled=true;feedback.textContent='';
    try{const r=await fetch('/api/market/stores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({country:selectedCountry,name:fd.get('name'),slug:fd.get('slug'),city:fd.get('city'),description:fd.get('description')||''})});const d=await r.json();if(!r.ok)throw new Error(d.error||'failed');await render();const note=document.createElement('p');note.className='market-seller-feedback';note.textContent=t.storeOk;root.querySelector('.market-seller-panel')?.prepend(note);}catch{feedback.textContent=t.failed;button.disabled=false;}
   });
   root.querySelector('#seller-listing-form')?.addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,fd=new FormData(form),button=form.querySelector('button'),feedback=form.querySelector('.market-seller-feedback'),price=fd.get('price');button.disabled=true;feedback.textContent='';
    try{const r=await fetch('/api/market/listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({country:selectedCountry,storeId:fd.get('storeId'),category:fd.get('category'),title:fd.get('title'),description:fd.get('description'),city:fd.get('city'),price:price===''?null:Number(price),listingType:'offer'})});const d=await r.json();if(!r.ok)throw new Error(d.error||'failed');feedback.textContent=t.listingOk;form.reset();}catch{feedback.textContent=t.failed;}finally{button.disabled=false;}
   });
  } catch {
   root.innerHTML='<section class="market-seller-panel"><h2>'+t.title+'</h2><p class="market-unavailable">'+t.unavailable+'</p></section>';
  }
 };
 render();
}
