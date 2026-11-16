const STORAGE_KEY = "houshyar.chat.preferences.v1";
const DEFAULTS = Object.freeze({ provider: "auto", mode: "auto", compare: false, googleSearch: false });
const PROVIDERS = new Set(["auto", "groq", "openai", "anthropic", "gemini"]);
const MODES = new Set(["auto", "fast", "balanced", "deep", "creative"]);

export function normalizeChatPreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULTS };
  return {
    provider: PROVIDERS.has(value.provider) ? value.provider : DEFAULTS.provider,
    mode: MODES.has(value.mode) ? value.mode : DEFAULTS.mode,
    compare: value.compare === true,
    googleSearch: value.googleSearch === true
  };
}

export function readChatPreferences(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    return normalizeChatPreferences(JSON.parse(target.getItem(STORAGE_KEY) || "null"));
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveChatPreferences(value, storage) {
  const preferences = normalizeChatPreferences(value);
  try {
    const target = storage ?? globalThis.localStorage;
    target.setItem(STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}
