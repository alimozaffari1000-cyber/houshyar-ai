function normalizeUsage(inputTokens, outputTokens, totalTokens) {
  if (!Number.isSafeInteger(inputTokens) || inputTokens < 0 ||
      !Number.isSafeInteger(outputTokens) || outputTokens < 0) return null;
  const total = Number.isSafeInteger(totalTokens) && totalTokens >= 0
    ? totalTokens : inputTokens + outputTokens;
  if (!Number.isSafeInteger(total)) return null;
  return { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens: total };
}

const CLAUDE_DEFAULT_MODEL = "claude-sonnet-5-5";
const GEMINI_DEFAULT_MODEL = "gemini-3.1-flash-lite";

function validateProviderRequest({ messages, maxTokens, temperature }) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 32) {
    throw new Error("provider_invalid_request");
  }
  let totalChars = 0;
  for (const item of messages) {
    if (!item || !["system", "user", "assistant"].includes(item.role) ||
        typeof item.content !== "string" || !item.content.trim() || item.content.length > 12000) {
      throw new Error("provider_invalid_request");
    }
    totalChars += item.content.length;
    if (totalChars > 32000) throw new Error("provider_invalid_request");
  }
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1 || maxTokens > 8192) {
    throw new Error("provider_invalid_request");
  }
  if (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new Error("provider_invalid_request");
  }
}

export function listAvailableProviders(env = {}) {
  return [
    { id: "groq", available: Boolean(env.GROQ_API_KEY), defaultModel: env.GROQ_MODEL || "llama-3.3-70b-versatile" },
    { id: "anthropic", available: Boolean(env.CLAUDE_API_KEY), defaultModel: env.CLAUDE_MODEL || CLAUDE_DEFAULT_MODEL },
    { id: "google", available: Boolean(env.GEMINI_API_KEY), defaultModel: env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL }
  ];
}

export function resolveProvider(env = {}, requested = "auto", mode = "balanced") {
  const available = listAvailableProviders(env);
  const requestedId = ["groq", "anthropic", "google"].includes(requested) ? requested : "auto";
  const configuredDefault = ["groq", "anthropic", "google"].includes(env.AI_DEFAULT_PROVIDER) ? env.AI_DEFAULT_PROVIDER : null;
  const selected = requestedId === "auto"
    ? (mode === "deep" && env.CLAUDE_API_KEY ? "anthropic" : (configuredDefault || (env.GROQ_API_KEY ? "groq" : (env.CLAUDE_API_KEY ? "anthropic" : "google"))))
    : requestedId;
  const provider = available.find(item => item.id === selected);
  if (!provider?.available) return { error: "PROVIDER_NOT_CONFIGURED", provider: selected };
  return { provider: selected, model: provider.defaultModel };
}

export async function requestModel({ provider, env, messages, model, signal, maxTokens = 1200, temperature = 0.5, webSearch = false }) {
  validateProviderRequest({ messages, maxTokens, temperature });
  if (provider === "google") {
    if (!env.GEMINI_API_KEY) throw new Error("provider_not_configured");
    const selectedModel = model || env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
    const system = messages.filter(item => item.role === "system").map(item => item.content).join("\n\n");
    const contents = messages.filter(item => item.role !== "system" && ["user", "assistant"].includes(item.role)).map(item => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }]
    }));
    if (!contents.length) throw new Error("provider_empty_prompt");
    // Gemini 3.x models use their recommended default sampling settings; do not override temperature.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: { maxOutputTokens: maxTokens },
        ...(webSearch ? { tools: [{ google_search: {} }] } : {})
      }),
      signal
    });
    if (!response.ok) throw new Error("provider_request_failed");
    const data = await response.json();
    const reply = Array.isArray(data?.candidates?.[0]?.content?.parts)
      ? data.candidates[0].content.parts.filter(part => typeof part?.text === "string").map(part => part.text).join("\n").trim()
      : "";
    if (!reply) throw new Error("provider_empty_reply");
    const usage = data.usageMetadata;
    const sourceMap = new Map();
    for (const chunk of data?.candidates?.[0]?.groundingMetadata?.groundingChunks || []) {
      const uri = chunk?.web?.uri;
      const title = chunk?.web?.title;
      if (typeof uri !== "string") continue;
      let parsedUri;
      try { parsedUri = new URL(uri); } catch { continue; }
      if (parsedUri.protocol !== "https:" || !parsedUri.hostname || parsedUri.username || parsedUri.password) continue;
      const safeUri = parsedUri.href;
      if (sourceMap.has(safeUri)) continue;
      sourceMap.set(safeUri, { title: typeof title === "string" && title.trim() ? title.trim().slice(0, 200) : safeUri, url: safeUri });
      if (sourceMap.size >= 8) break;
    }
    return {
      reply,
      sources: [...sourceMap.values()],
      model: data.modelVersion || selectedModel,
      usage: usage ? normalizeUsage(usage.promptTokenCount, usage.candidatesTokenCount, usage.totalTokenCount) : null
    };
  }

  if (provider === "anthropic") {
    if (!env.CLAUDE_API_KEY) throw new Error("provider_not_configured");
    const system = messages.filter(item => item.role === "system").map(item => item.content).join("\n\n");
    const conversation = messages.filter(item => item.role !== "system");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      // Claude Sonnet 5.5 rejects temperature, top_p, and top_k with HTTP 400.
      // Keep sampling controls provider-specific instead of forwarding Groq settings.
      body: JSON.stringify({
        model: model || env.CLAUDE_MODEL || CLAUDE_DEFAULT_MODEL,
        max_tokens: maxTokens,
        system,
        messages: conversation
      }),
      signal
    });
    if (!response.ok) throw new Error("provider_request_failed");
    const data = await response.json();
    const reply = Array.isArray(data?.content)
      ? data.content.filter(block => block?.type === "text").map(block => block.text).join("\n").trim()
      : "";
    if (!reply) throw new Error("provider_empty_reply");
    return {
      reply,
      model: data.model || model || env.CLAUDE_MODEL || CLAUDE_DEFAULT_MODEL,
      usage: data.usage ? normalizeUsage(data.usage.input_tokens, data.usage.output_tokens) : null
    };
  }

  if (provider !== "groq" || !env.GROQ_API_KEY) throw new Error("provider_not_configured");
  const selectedModel = model || env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: selectedModel, messages, temperature, max_tokens: maxTokens }),
    signal
  });
  if (!response.ok) throw new Error("provider_request_failed");
  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) throw new Error("provider_empty_reply");
  return {
    reply: reply.trim(),
    model: data.model || selectedModel,
    usage: data.usage ? normalizeUsage(data.usage.prompt_tokens, data.usage.completion_tokens, data.usage.total_tokens) : null
  };
}
