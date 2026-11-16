const ALLOWED_PROVIDERS = new Set(["groq", "openai", "anthropic"]);

export function normalizeProviderStatus(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.providers)) {
    return { status: "unknown", providers: {} };
  }
  const providers = {};
  for (const item of payload.providers) {
    if (!item || !ALLOWED_PROVIDERS.has(item.id)) continue;
    providers[item.id] = {
      configured: item.available === true,
      defaultModel: typeof item.defaultModel === "string" ? item.defaultModel.slice(0, 100) : null
    };
  }
  return {
    status: payload.aiConfigured === true ? "configured" : "needs_setup",
    providers
  };
}

export function providerStatusLabel(provider, status, locale = "fa") {
  const configured = status?.providers?.[provider]?.configured;
  if (configured === true) {
    return ({ fa: "کلید تنظیم شده", en: "Key configured", de: "Schlüssel konfiguriert" })[locale] || "Key configured";
  }
  if (configured === false) {
    return ({ fa: "کلید تنظیم نشده", en: "Key not configured", de: "Schlüssel fehlt" })[locale] || "Key not configured";
  }
  return ({ fa: "وضعیت نامشخص", en: "Status unknown", de: "Status unbekannt" })[locale] || "Status unknown";
}
