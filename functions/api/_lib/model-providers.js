const CLAUDE_DEFAULT_MODEL = "claude-sonnet-5-5";
const OPENAI_DEFAULT_MODEL = "gpt-6-astra";
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";
const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";

export function listAvailableProviders(env = {}) {
  return [
    { id: "groq", available: Boolean(env.GROQ_API_KEY), defaultModel: env.GROQ_MODEL || GROQ_DEFAULT_MODEL },
    { id: "openai", available: Boolean(env.OPENAI_API_KEY), defaultModel: env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL },
    { id: "anthropic", available: Boolean(env.CLAUDE_API_KEY), defaultModel: env.CLAUDE_MODEL || CLAUDE_DEFAULT_MODEL },
    { id: "gemini", available: Boolean(env.GEMINI_API_KEY), defaultModel: env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL }
  ];
}

export function resolveProvider(env = {}, requested = "auto", mode = "balanced") {
  const available = listAvailableProviders(env);
  const requestedId = ["groq", "openai", "anthropic", "gemini"].includes(requested) ? requested : "auto";
  let selected = requestedId;
  if (requestedId === "auto") {
    const configuredDefault = available.find(item => item.id === env.AI_DEFAULT_PROVIDER && item.available);
    selected = configuredDefault?.id || (mode === "deep" && env.CLAUDE_API_KEY ? "anthropic" :
      (env.GROQ_API_KEY ? "groq" : (env.OPENAI_API_KEY ? "openai" : (env.CLAUDE_API_KEY ? "anthropic" : "gemini"))));
  }
  const provider = available.find(item => item.id === selected);
  if (!provider?.available) return { error: "PROVIDER_NOT_CONFIGURED", provider: selected };
  return { provider: selected, model: provider.defaultModel };
}

function modelForProvider(provider, env, model) {
  if (model) return model;
  if (provider === "anthropic") return env.CLAUDE_MODEL || CLAUDE_DEFAULT_MODEL;
  if (provider === "gemini") return env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  if (provider === "openai") return env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;
  return env.GROQ_MODEL || GROQ_DEFAULT_MODEL;
}

function openAICompatibleConfig(provider, env) {
  if (provider === "openai" && env.OPENAI_API_KEY) return { url: "https://api.openai.com/v1/chat/completions", headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" } };
  if (provider === "groq" && env.GROQ_API_KEY) return { url: "https://api.groq.com/openai/v1/chat/completions", headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" } };
  throw new Error("provider_not_configured");
}


function geminiContents(messages) {
  const system = messages.filter(item => item.role === "system").map(item => item.content).join("\n\n");
  const contents = messages.filter(item => item.role !== "system").map(item => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: (Array.isArray(item.content) ? item.content : [{ type: "text", text: item.content }]).map(part => {
      if (part?.type === "image_url" && typeof part.image_url?.url === "string") {
        const match = part.image_url.url.match(/^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/);
        if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
      }
      if (part?.type === "text" && typeof part.text === "string") return { text: part.text };
      return null;
    }).filter(Boolean)
  })).filter(item => item.parts.length);
  return { system, contents };
}

function geminiRequestBody(messages, { maxTokens, temperature, googleSearch }) {
  const { system, contents } = geminiContents(messages);
  const body = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (googleSearch) body.tools = [{ google_search: {} }];
  return body;
}

function geminiResult(data, selectedModel) {
  const candidate = data?.candidates?.[0];
  const reply = Array.isArray(candidate?.content?.parts)
    ? candidate.content.parts.filter(part => typeof part?.text === "string" && !part.thought).map(part => part.text).join("").trim()
    : "";
  if (!reply) throw new Error("provider_empty_reply");
  const usage = data.usageMetadata ? {
    promptTokens: data.usageMetadata.promptTokenCount || 0,
    completionTokens: data.usageMetadata.candidatesTokenCount || 0,
    totalTokens: data.usageMetadata.totalTokenCount || 0
  } : null;
  const chunks = candidate?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map(item => item?.web?.uri ? { title: String(item.web.title || item.web.uri).slice(0, 240), url: item.web.uri } : null).filter(Boolean).slice(0, 8);
  return { reply, model: data.modelVersion || selectedModel, usage, sources };
}

export async function requestModel({ provider, env, messages, model, signal, maxTokens = 1200, temperature = 0.5, googleSearch = false }) {
  if (provider === "gemini") {
    if (!env.GEMINI_API_KEY) throw new Error("provider_not_configured");
    const selectedModel = modelForProvider(provider, env, model);
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(selectedModel) + ":generateContent", {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(geminiRequestBody(messages, { maxTokens, temperature, googleSearch })),
      signal
    });
    if (!response.ok) throw new Error("provider_request_failed");
    return geminiResult(await response.json(), selectedModel);
  }
  if (provider === "anthropic") {
    if (!env.CLAUDE_API_KEY) throw new Error("provider_not_configured");
    const system = messages.filter(item => item.role === "system").map(item => item.content).join("\n\n");
    const conversation = messages.filter(item => item.role !== "system");
    const selectedModel = modelForProvider(provider, env, model);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: selectedModel, max_tokens: maxTokens, system, messages: conversation }),
      signal
    });
    if (!response.ok) throw new Error("provider_request_failed");
    const data = await response.json();
    const reply = Array.isArray(data?.content) ? data.content.filter(block => block?.type === "text").map(block => block.text).join("\n").trim() : "";
    if (!reply) throw new Error("provider_empty_reply");
    return { reply, model: data.model || selectedModel, usage: data.usage ? { promptTokens: data.usage.input_tokens || 0, completionTokens: data.usage.output_tokens || 0, totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) } : null };
  }
  const config = openAICompatibleConfig(provider, env);
  const selectedModel = modelForProvider(provider, env, model);
  const requestBody = provider === "openai"
    ? { model: selectedModel, messages, max_completion_tokens: maxTokens }
    : { model: selectedModel, messages, temperature, max_completion_tokens: maxTokens };
  const response = await fetch(config.url, { method: "POST", headers: config.headers, body: JSON.stringify(requestBody), signal });
  if (!response.ok) throw new Error("provider_request_failed");
  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) throw new Error("provider_empty_reply");
  return { reply: reply.trim(), model: data.model || selectedModel, usage: data.usage ? { promptTokens: data.usage.prompt_tokens || 0, completionTokens: data.usage.completion_tokens || 0, totalTokens: data.usage.total_tokens || 0 } : null };
}

export async function streamModel({ provider, env, messages, model, signal, maxTokens = 1200, temperature = 0.5, googleSearch = false, onText }) {
  const isGemini = provider === "gemini";\n  if (isGemini && !env.GEMINI_API_KEY) throw new Error("provider_not_configured");\n  const isClaude = provider === "anthropic";
  if (isClaude && !env.CLAUDE_API_KEY) throw new Error("provider_not_configured");
  const config = isClaude || isGemini ? null : openAICompatibleConfig(provider, env);
  const selectedModel = modelForProvider(provider, env, model);
  const system = messages.filter(item => item.role === "system").map(item => item.content).join("\n\n");
  const conversation = messages.filter(item => item.role !== "system");
  const endpoint = isGemini\n    ? "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(selectedModel) + ":streamGenerateContent?alt=sse"\n    : (isClaude ? "https://api.anthropic.com/v1/messages" : config.url);\n  const response = await fetch(endpoint, {
    method: "POST",
    headers: isGemini ? { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" } : (isClaude ? { "x-api-key": env.CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } : config.headers),
    body: JSON.stringify(isGemini ? geminiRequestBody(messages, { maxTokens, temperature, googleSearch }) : (isClaude ? { model: selectedModel, max_tokens: maxTokens, system, messages: conversation, stream: true } : (provider === "openai" ? { model: selectedModel, messages, max_completion_tokens: maxTokens, stream: true } : { model: selectedModel, messages, temperature, max_completion_tokens: maxTokens, stream: true }))),
    signal
  });
  if (!response.ok || !response.body) throw new Error("provider_request_failed");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", reply = "", usage = null, sources = [];
  const consumeEvent = block => {
    const dataLines = block.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).replace(/^ /, ""));
    if (!dataLines.length) return;
    const raw = dataLines.join("\n").trim();
    if (!raw || raw === "[DONE]") return;
    let event; try { event = JSON.parse(raw); } catch { return; }
    let delta = "";
    if (isGemini) {
      const candidate = event.candidates?.[0];
      delta = (candidate?.content?.parts || []).filter(part => typeof part?.text === "string" && !part.thought).map(part => part.text).join("");
      if (event.usageMetadata) usage = { promptTokens: event.usageMetadata.promptTokenCount || 0, completionTokens: event.usageMetadata.candidatesTokenCount || 0, totalTokens: event.usageMetadata.totalTokenCount || 0 };
      const chunks = candidate?.groundingMetadata?.groundingChunks || [];
      sources = chunks.map(item => item?.web?.uri ? { title: String(item.web.title || item.web.uri).slice(0, 240), url: item.web.uri } : null).filter(Boolean).slice(0, 8);
    } else if (isClaude) {
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") delta = event.delta.text || "";
      if (event.type === "message_start" && event.message?.usage) { const inputTokens = event.message.usage.input_tokens || 0; usage = { promptTokens: inputTokens, completionTokens: 0, totalTokens: inputTokens }; }
      if (event.type === "message_delta" && event.usage) { const completionTokens = event.usage.output_tokens || 0; const promptTokens = usage?.promptTokens || 0; usage = { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }; }
    } else {
      delta = event.choices?.[0]?.delta?.content || "";
      if (event.usage) usage = { promptTokens: event.usage.prompt_tokens || 0, completionTokens: event.usage.completion_tokens || 0, totalTokens: event.usage.total_tokens || 0 };
    }
    if (delta) { reply += delta; onText(delta); }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/); buffer = blocks.pop() || "";
      for (const block of blocks) consumeEvent(block);
    }
    buffer += decoder.decode();
    if (buffer.trim()) consumeEvent(buffer);
  } finally { reader.releaseLock(); }
  if (!reply.trim()) throw new Error("provider_empty_reply");
  return { reply: reply.trim(), model: selectedModel, usage, sources };
}