export const TRANSLATION_LANGUAGES = Object.freeze([
  ["af", "Afrikaans"], ["sq", "Albanian"], ["am", "Amharic"], ["ar", "Arabic"],
  ["hy", "Armenian"], ["az", "Azerbaijani"], ["eu", "Basque"], ["be", "Belarusian"],
  ["bn", "Bengali"], ["bs", "Bosnian"], ["bg", "Bulgarian"], ["my", "Burmese"],
  ["ca", "Catalan"], ["zh", "Chinese"], ["co", "Corsican"], ["hr", "Croatian"],
  ["cs", "Czech"], ["da", "Danish"], ["nl", "Dutch"], ["en", "English"],
  ["eo", "Esperanto"], ["et", "Estonian"], ["fo", "Faroese"], ["fj", "Fijian"],
  ["fi", "Finnish"], ["fr", "French"], ["gl", "Galician"], ["ka", "Georgian"],
  ["de", "German"], ["el", "Greek"], ["gu", "Gujarati"], ["ht", "Haitian Creole"],
  ["ha", "Hausa"], ["he", "Hebrew"], ["hi", "Hindi"], ["hu", "Hungarian"],
  ["is", "Icelandic"], ["id", "Indonesian"], ["ga", "Irish"], ["it", "Italian"],
  ["ja", "Japanese"], ["jv", "Javanese"], ["kn", "Kannada"], ["kk", "Kazakh"],
  ["km", "Khmer"], ["ko", "Korean"], ["ku", "Kurdish"], ["ky", "Kyrgyz"],
  ["lo", "Lao"], ["la", "Latin"], ["lv", "Latvian"], ["lt", "Lithuanian"],
  ["lb", "Luxembourgish"], ["mk", "Macedonian"], ["mg", "Malagasy"], ["ms", "Malay"],
  ["ml", "Malayalam"], ["mt", "Maltese"], ["mi", "Maori"], ["mr", "Marathi"],
  ["mn", "Mongolian"], ["ne", "Nepali"], ["no", "Norwegian"], ["or", "Odia"],
  ["ps", "Pashto"], ["fa", "Persian"], ["pl", "Polish"], ["pt", "Portuguese"],
  ["pa", "Punjabi"], ["ro", "Romanian"], ["ru", "Russian"], ["rw", "Kinyarwanda"],
  ["gd", "Scottish Gaelic"], ["sr", "Serbian"], ["si", "Sinhala"], ["sk", "Slovak"],
  ["sl", "Slovenian"], ["so", "Somali"], ["es", "Spanish"], ["su", "Sundanese"],
  ["sw", "Swahili"], ["sv", "Swedish"], ["tl", "Tagalog"], ["tg", "Tajik"],
  ["ta", "Tamil"], ["tt", "Tatar"], ["te", "Telugu"], ["th", "Thai"],
  ["bo", "Tibetan"], ["ti", "Tigrinya"], ["tr", "Turkish"], ["tk", "Turkmen"],
  ["uk", "Ukrainian"], ["ur", "Urdu"], ["ug", "Uyghur"], ["uz", "Uzbek"],
  ["vi", "Vietnamese"], ["cy", "Welsh"], ["wo", "Wolof"], ["xh", "Xhosa"],
  ["yi", "Yiddish"], ["yo", "Yoruba"], ["zu", "Zulu"]
].map(([code, name]) => Object.freeze({ code, name })));

const LANGUAGE_BY_CODE = new Map(TRANSLATION_LANGUAGES.map(language => [language.code, language.name]));

export function getTranslationLanguageName(code) {
  return LANGUAGE_BY_CODE.get(String(code || "").trim().toLowerCase()) || "";
}
