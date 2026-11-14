const MARKETS = {
  IR: {
    flag: '🇮🇷', name: { fa: 'ایران', en: 'Iran', de: 'Iran' },
    currency: 'IRR / تومان', language: { fa: 'فارسی', en: 'Persian', de: 'Persisch' },
    cityLabel: { fa: 'شهر و استان', en: 'City and province', de: 'Stadt und Provinz' },
    categories: {
      fa: ['فروشگاه‌ها', 'ملک', 'خودرو', 'استخدام', 'خدمات محلی', 'کالا و دست‌دوم'],
      en: ['Stores', 'Property', 'Vehicles', 'Jobs', 'Local services', 'Goods & used items'],
      de: ['Shops', 'Immobilien', 'Fahrzeuge', 'Jobs', 'Lokale Dienste', 'Waren & gebraucht']
    }
  },
  AE: {
    flag: '🇦🇪', name: { fa: 'امارات متحده عربی', en: 'United Arab Emirates', de: 'Vereinigte Arabische Emirate' },
    currency: 'AED (درهم)', language: { fa: 'عربی / انگلیسی', en: 'Arabic / English', de: 'Arabisch / Englisch' },
    cityLabel: { fa: 'شهر / امارت', en: 'City / Emirate', de: 'Stadt / Emirat' },
    categories: {
      fa: ['فروشگاه‌های امارات', 'املاک و اجاره', 'خودرو', 'فرصت‌های شغلی', 'گردشگری و حمل‌ونقل', 'خدمات تجاری'],
      en: ['UAE stores', 'Property & rentals', 'Vehicles', 'Jobs', 'Tourism & transport', 'Business services'],
      de: ['Shops in den VAE', 'Immobilien & Miete', 'Fahrzeuge', 'Jobs', 'Tourismus & Transport', 'Geschäftsdienste']
    }
  },
  DE: {
    flag: '🇩🇪', name: { fa: 'آلمان', en: 'Germany', de: 'Deutschland' },
    currency: 'EUR (€)', language: { fa: 'آلمانی', en: 'German', de: 'Deutsch' },
    cityLabel: { fa: 'شهر و ایالت', en: 'City and state', de: 'Stadt und Bundesland' },
    categories: {
      fa: ['فروشگاه‌های محلی', 'املاک', 'خودرو', 'استخدام', 'خدمات', 'کالاهای دست‌دوم'],
      en: ['Local stores', 'Property', 'Vehicles', 'Jobs', 'Services', 'Second-hand goods'],
      de: ['Lokale Geschäfte', 'Immobilien', 'Fahrzeuge', 'Jobs', 'Dienstleistungen', 'Gebrauchtwaren']
    }
  },
  TR: {
    flag: '🇹🇷', name: { fa: 'ترکیه', en: 'Türkiye', de: 'Türkei' },
    currency: 'TRY (₺)', language: { fa: 'ترکی', en: 'Turkish', de: 'Türkisch' },
    cityLabel: { fa: 'شهر و استان', en: 'City and province', de: 'Stadt und Provinz' },
    categories: {
      fa: ['فروشگاه‌ها', 'املاک', 'خودرو', 'استخدام', 'خدمات محلی', 'کالا و پوشاک'],
      en: ['Stores', 'Property', 'Vehicles', 'Jobs', 'Local services', 'Goods & fashion'],
      de: ['Geschäfte', 'Immobilien', 'Fahrzeuge', 'Jobs', 'Lokale Dienste', 'Waren & Mode']
    }
  }
};

const COPY = {
  fa: {
    title: 'بازار محلی هوش‌یار', country: 'کشور بازار', currency: 'واحد پول', language: 'زبان‌های رایج',
    city: 'محدوده جست‌وجو', categories: 'دسته‌بندی‌های این کشور',
    note: 'این انتخاب، بازار محلی را مشخص می‌کند. فهرست واقعی فروشگاه‌ها و آگهی‌ها پس از راه‌اندازی پایگاه داده و ثبت فروشندگان نمایش داده می‌شود.',
    global: 'بازار بین‌المللی', hint: 'کشور را انتخاب کنید؛ نتایج کشورها به‌صورت پیش‌فرض با هم ترکیب نمی‌شوند.'
  },
  en: {
    title: 'Houshyar local marketplace', country: 'Market country', currency: 'Currency', language: 'Common languages',
    city: 'Search area', categories: 'Categories in this country',
    note: 'This selects the local market. Real stores and listings will appear after the marketplace database and seller onboarding are implemented.',
    global: 'International market', hint: 'Choose a country. Country results are kept separate by default.'
  },
  de: {
    title: 'Lokaler Houshyar-Marktplatz', country: 'Marktland', currency: 'Währung', language: 'Übliche Sprachen',
    city: 'Suchgebiet', categories: 'Kategorien in diesem Land',
    note: 'Damit wird der lokale Markt ausgewählt. Echte Shops und Anzeigen erscheinen nach Einrichtung der Marktplatz-Datenbank und Händlerregistrierung.',
    global: 'Internationaler Markt', hint: 'Wählen Sie ein Land. Länderergebnisse werden standardmäßig getrennt gehalten.'
  }
};

const safe = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const getSavedCountry = () => {
  try {
    const saved = localStorage.getItem('houshyar-market-country');
    return MARKETS[saved] ? saved : 'IR';
  } catch { return 'IR'; }
};

export function initCountryMarket(app, getLocale) {
  const root = app.querySelector('#country-market-root');
  if (!root) return;
  let country = getSavedCountry();

  const render = () => {
    const locale = ['fa', 'en', 'de'].includes(getLocale()) ? getLocale() : 'en';
    const copy = COPY[locale];
    const market = MARKETS[country];
    const options = Object.entries(MARKETS).map(([code, item]) =>
      '<option value="' + code + '"' + (code === country ? ' selected' : '') + '>' + item.flag + ' ' + safe(item.name[locale] || item.name.en) + '</option>'
    ).join('');
    const categories = market.categories[locale] || market.categories.en;
    root.innerHTML = `
      <section class="country-market" aria-labelledby="country-market-title">
        <div class="country-market-head">
          <div><span class="country-market-kicker">HOUSHYAR MARKET</span><h2 id="country-market-title">${copy.title}</h2><p>${copy.hint}</p></div>
          <label class="country-market-picker"><span>${copy.country}</span><select id="market-country" aria-label="${copy.country}">${options}</select></label>
        </div>
        <div class="country-market-meta">
          <span><small>${copy.currency}</small><b>${safe(market.currency)}</b></span>
          <span><small>${copy.language}</small><b>${safe(market.language[locale] || market.language.en)}</b></span>
          <span><small>${copy.city}</small><b>${safe(market.cityLabel[locale] || market.cityLabel.en)}</b></span>
        </div>
        <div class="country-market-categories"><h3>${copy.categories}</h3><div>${categories.map(category => '<span>' + safe(category) + '</span>').join('')}</div></div>
        <p class="country-market-note">${copy.note}</p>
      </section>`;
    root.querySelector('#market-country').addEventListener('change', event => {
      if (!MARKETS[event.target.value]) return;
      country = event.target.value;
      try { localStorage.setItem('houshyar-market-country', country); } catch {}
      render();
    });
  };

  render();
  return { getCountry: () => country, render };
}
