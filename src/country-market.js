const MARKETS = {
  IR: { flag:'🇮🇷', name:{fa:'ایران',en:'Iran',de:'Iran'}, currency:'IRR', currencyLabel:'تومان / ریال', language:{fa:'فارسی',en:'Persian',de:'Persisch'}, cityLabel:{fa:'شهر و استان',en:'City and province',de:'Stadt und Provinz'}, categories:{fa:['کالا و پوشاک','ملک','خودرو','استخدام','خدمات محلی','فروشگاه‌ها'],en:['Goods & fashion','Property','Vehicles','Jobs','Local services','Stores'],de:['Waren & Mode','Immobilien','Fahrzeuge','Jobs','Lokale Dienste','Geschäfte']} },
  AE: { flag:'🇦🇪', name:{fa:'امارات متحده عربی',en:'United Arab Emirates',de:'Vereinigte Arabische Emirate'}, currency:'AED', currencyLabel:'درهم امارات', language:{fa:'عربی / انگلیسی',en:'Arabic / English',de:'Arabisch / Englisch'}, cityLabel:{fa:'شهر / امارت',en:'City / Emirate',de:'Stadt / Emirat'}, categories:{fa:['کالا و پوشاک','املاک و اجاره','خودرو','فرصت‌های شغلی','گردشگری و حمل‌ونقل','فروشگاه‌های امارات'],en:['Goods & fashion','Property & rentals','Vehicles','Jobs','Tourism & transport','UAE stores'],de:['Waren & Mode','Immobilien & Miete','Fahrzeuge','Jobs','Tourismus & Transport','Shops in den VAE']} },
  DE: { flag:'🇩🇪', name:{fa:'آلمان',en:'Germany',de:'Deutschland'}, currency:'EUR', currencyLabel:'یورو', language:{fa:'آلمانی',en:'German',de:'Deutsch'}, cityLabel:{fa:'شهر و ایالت',en:'City and state',de:'Stadt und Bundesland'}, categories:{fa:['کالاهای محلی','املاک','خودرو','استخدام','خدمات','فروشگاه‌ها'],en:['Local goods','Property','Vehicles','Jobs','Services','Stores'],de:['Lokale Waren','Immobilien','Fahrzeuge','Jobs','Dienstleistungen','Geschäfte']} },
  TR: { flag:'🇹🇷', name:{fa:'ترکیه',en:'Türkiye',de:'Türkei'}, currency:'TRY', currencyLabel:'لیر ترکیه', language:{fa:'ترکی',en:'Turkish',de:'Türkisch'}, cityLabel:{fa:'شهر و استان',en:'City and province',de:'Stadt und Provinz'}, categories:{fa:['کالا و پوشاک','املاک','خودرو','استخدام','خدمات محلی','فروشگاه‌ها'],en:['Goods & fashion','Property','Vehicles','Jobs','Local services','Stores'],de:['Waren & Mode','Immobilien','Fahrzeuge','Jobs','Lokale Dienste','Geschäfte']} }
};
const CATEGORY_KEYS=['goods','property','vehicles','jobs','services','fashion'];
const COPY={
 fa:{title:'بازار محلی هوش‌یار',country:'کشور بازار',currency:'واحد پول',language:'زبان‌های رایج',city:'محدوده جست‌وجو',categories:'دسته‌بندی‌های این کشور',note:'فقط فروشگاه‌ها و آگهی‌های همین کشور نمایش داده می‌شوند. آگهی‌های جدید پس از بررسی و تأیید منتشر خواهند شد.',hint:'کشور را انتخاب کنید؛ بازار هر کشور جداگانه نمایش داده می‌شود.',search:'جست‌وجو در آگهی‌ها',cityPlaceholder:'شهر (اختیاری)',searchPlaceholder:'نام کالا، خدمت یا آگهی...',all:'همه دسته‌ها',listings:'آگهی‌های منتشرشده',stores:'فروشگاه‌های فعال',emptyListings:'هنوز آگهی تأییدشده‌ای در این بازار وجود ندارد.',emptyStores:'هنوز فروشگاه تأییدشده‌ای در این کشور ثبت نشده است.',loading:'در حال دریافت اطلاعات بازار...',unavailable:'اطلاعات بازار فعلاً در دسترس نیست. اتصال پایگاه داده باید در Cloudflare فعال شود.',noPrice:'برای قیمت تماس بگیرید',store:'فروشگاه',international:'بازار بین‌المللی'},
 en:{title:'Houshyar local marketplace',country:'Market country',currency:'Currency',language:'Common languages',city:'Search area',categories:'Categories in this country',note:'Only stores and listings from this country are shown. New listings are published after review and approval.',hint:'Choose a country. Each country market is shown separately.',search:'Search listings',cityPlaceholder:'City (optional)',searchPlaceholder:'Product, service or listing...',all:'All categories',listings:'Published listings',stores:'Active stores',emptyListings:'There are no approved listings in this market yet.',emptyStores:'There are no approved stores in this country yet.',loading:'Loading market data...',unavailable:'Market data is temporarily unavailable. The database connection must be enabled in Cloudflare.',noPrice:'Contact for price',store:'Store',international:'International market'},
 de:{title:'Lokaler Houshyar-Marktplatz',country:'Marktland',currency:'Währung',language:'Übliche Sprachen',city:'Suchgebiet',categories:'Kategorien in diesem Land',note:'Es werden nur Shops und Anzeigen aus diesem Land angezeigt. Neue Anzeigen werden nach Prüfung freigeschaltet.',hint:'Wählen Sie ein Land. Jeder Ländermarkt wird getrennt angezeigt.',search:'Anzeigen suchen',cityPlaceholder:'Stadt (optional)',searchPlaceholder:'Produkt, Dienstleistung oder Anzeige...',all:'Alle Kategorien',listings:'Veröffentlichte Anzeigen',stores:'Aktive Shops',emptyListings:'In diesem Markt gibt es noch keine freigegebenen Anzeigen.',emptyStores:'In diesem Land gibt es noch keine freigegebenen Shops.',loading:'Marktdaten werden geladen...',unavailable:'Marktdaten sind derzeit nicht verfügbar. Die Datenbankverbindung muss in Cloudflare aktiviert werden.',noPrice:'Preis auf Anfrage',store:'Shop',international:'Internationaler Markt'}
};
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const getSavedCountry=()=>{try{const saved=localStorage.getItem('houshyar-market-country');return MARKETS[saved]?saved:'IR';}catch{return 'IR';}};
export function initCountryMarket(app,getLocale){
 const root=app.querySelector('#country-market-root');if(!root)return;
 let country=getSavedCountry(), requestId=0, activeCategory='', activeQuery='', activeCity='', sellerStores=[], sellerMessage='';
 const localeNow=()=>['fa','en','de'].includes(getLocale())?getLocale():'en';
 const render=()=>{
  const locale=localeNow(),copy=COPY[locale],market=MARKETS[country];
  const options=Object.entries(MARKETS).map(([code,item])=>'<option value="'+code+'"'+(code===country?' selected':'')+'>'+item.flag+' '+safe(item.name[locale]||item.name.en)+'</option>').join('');
  const categories=market.categories[locale]||market.categories.en;
  root.innerHTML=`
   <section class="country-market" aria-labelledby="country-market-title">
    <div class="country-market-head"><div><span class="country-market-kicker">HOUSHYAR MARKET</span><h2 id="country-market-title">${copy.title}</h2><p>${copy.hint}</p></div>
     <label class="country-market-picker"><span>${copy.country}</span><select id="market-country" aria-label="${copy.country}">${options}</select></label></div>
    <div class="country-market-meta"><span><small>${copy.currency}</small><b>${safe(market.currencyLabel)}</b></span><span><small>${copy.language}</small><b>${safe(market.language[locale]||market.language.en)}</b></span><span><small>${copy.city}</small><b>${safe(market.cityLabel[locale]||market.cityLabel.en)}</b></span></div>
    <div class="country-market-categories"><h3>${copy.categories}</h3><div>${categories.map((category,i)=>'<button type="button" data-market-category="'+CATEGORY_KEYS[i]+'" class="'+(activeCategory===CATEGORY_KEYS[i]?'active':'')+'">'+safe(category)+'</button>').join('')}</div></div>
    <form class="market-search" id="market-search"><input id="market-query" maxlength="80" value="${safe(activeQuery)}" placeholder="${copy.searchPlaceholder}" aria-label="${copy.search}"><input id="market-city" maxlength="100" value="${safe(activeCity)}" placeholder="${copy.cityPlaceholder}" aria-label="${copy.city}"><button type="submit">${copy.search}</button></form>
    <p class="country-market-note">${copy.note}</p>
    <div class="market-results" aria-live="polite"><p class="market-loading">${copy.loading}</p></div>
   </section>`;
  root.querySelector('#market-country').addEventListener('change',e=>{if(!MARKETS[e.target.value])return;country=e.target.value;activeCategory='';activeQuery='';activeCity='';try{localStorage.setItem('houshyar-market-country',country);}catch{}render();});
  root.querySelectorAll('[data-market-category]').forEach(button=>button.addEventListener('click',()=>{activeCategory=activeCategory===button.dataset.marketCategory?'':button.dataset.marketCategory;render();}));
  root.querySelector('#market-search').addEventListener('submit',e=>{e.preventDefault();activeQuery=root.querySelector('#market-query').value.trim();activeCity=root.querySelector('#market-city').value.trim();loadMarketData();});
  loadMarketData();
 };
 const loadMarketData=async()=>{
  const current=++requestId,locale=localeNow(),copy=COPY[locale],results=root.querySelector('.market-results');if(!results)return;
  results.innerHTML='<p class="market-loading">'+copy.loading+'</p>';
  const params=new URLSearchParams({country,limit:'20'});if(activeCategory)params.set('category',activeCategory);if(activeQuery)params.set('q',activeQuery);if(activeCity)params.set('city',activeCity);
  try{
   const [listingResponse,storeResponse]=await Promise.all([fetch('/api/market/listings?'+params.toString()),fetch('/api/market/stores?country='+encodeURIComponent(country)+'&limit=12'+(activeCity?'&city='+encodeURIComponent(activeCity):''))]);
   if(!listingResponse.ok||!storeResponse.ok)throw new Error('market unavailable');
   const [listingData,storeData]=await Promise.all([listingResponse.json(),storeResponse.json()]);
   if(current!==requestId)return;
   const listings=Array.isArray(listingData.listings)?listingData.listings:[],stores=Array.isArray(storeData.stores)?storeData.stores:[];
   const formatPrice=item=>item.price_amount===null||item.price_amount===undefined?copy.noPrice:new Intl.NumberFormat(locale==='fa'?'fa-IR':locale==='de'?'de-DE':'en-US').format(item.price_amount)+' '+safe(item.currency_code||MARKETS[country].currency);
   results.innerHTML='<h3>'+copy.listings+'</h3>'+(listings.length?'<div class="market-listing-grid">'+listings.map(item=>'<article class="market-listing"><span class="market-listing-tag">'+safe(item.category)+'</span><h4>'+safe(item.title)+'</h4><p>'+safe(item.description)+'</p><div><b>'+formatPrice(item)+'</b><small>'+safe(item.city)+'</small></div><small>'+copy.store+': '+safe(item.store_name)+'</small></article>').join('')+'</div>':'<p class="market-empty">'+copy.emptyListings+'</p>')+'<h3>'+copy.stores+'</h3>'+(stores.length?'<div class="market-store-grid">'+stores.map(item=>'<article class="market-store"><b>'+safe(item.name)+'</b><small>'+safe(item.city)+'</small><p>'+safe(item.description)+'</p></article>').join('')+'</div>':'<p class="market-empty">'+copy.emptyStores+'</p>');
  }catch{if(current===requestId)results.innerHTML='<p class="market-unavailable">'+copy.unavailable+'</p>';}
 };
 render();
 return {getCountry:()=>country,render,refresh:loadMarketData};
}
