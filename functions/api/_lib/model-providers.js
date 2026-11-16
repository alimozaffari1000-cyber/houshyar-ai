const CLAUDE_DEFAULT_MODEL = "claude-sonnet-5-5";
const OPENAI_DEFAULT_MODEL = "gpt-6-astra";
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

export function listAvailableProviders(env = {}) {
  return [
    { id: "groq", available: Boolean(env.GROQ_API_KEY), defaultModel: env.GROQ_MODEL || GROQ_DEFAULT_MODEL },
    { id: "openai", available: Boolean(env.OPENAI_API_KEY), defaultModel: env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL },
    { id: "anthropic", available: Boolean(env.CLAUDE_API_KEY), defaultModel: env.CLAUDE_MODEL || CLAUDE_DEFAULT_MODEL }
  ];
}

export function resolveProvider(env = {}, requested = "auto", mode = "balanced") {
  const available = listAvailableProviders(env);
  const requestedId = ["groq", "openai", "anthropic"].includes(requested) ? requested : "auto";
  let selected = requestedId;
  if (requestedId === "auto") {
    const configuredDefault = available.find(item => item.id === env.AI_DEFAULT_PROVIDER && item.available);
    selected = configuredDefault?.id || (mode === "deep" && env.CLAUDE_API_KEY ? "anthropic" :
      (env.GROQ_API_KEY ? "groq" : (env.OPENAI_API_KEY ? "openai" : "anthropic")));
  }
  const provider = available.find(item => item.id === selected);
  if (!provider?.available) return { error: "PROVIDER_NOT_CONFIGURED", provider: selected };
  return { provider: selected, model: provider.defaultModel };
}

function modelForProvider(provider, env, model) {
  if (model) return model;
  if (provider === "anthropic") return env.CLAUDE_MODEL || CLAUDE_DEFAULT_MODEL;
  if (provider === "openai") return env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;
  return env.GROQ_MODEL || GROQ_DEFAULT_MODEL;
}

function openAICompatibleConfig(provider, env) {
  if (provider === "openai" && env.OPENAI_API_KEY) return { url: "https://api.openai.com/v1/chat/completions", headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" } };
  if (provider === "groq" && env.GROQ_API_KEY) return { url: "https://api.groq.com/openai/v1/chat/completions", headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" } };
  throw new Error("provider_not_configured");
}

export async function requestModel({ provider, env, messages, model, signal, maxTokens = 1200, temperature = 0.5 }) {
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
    : { model: selectedModel, messages, temperature, max_tokens: maxTokens };
  const response = await fetch(config.url, { method: "POST", headers: config.headers, body: JSON.stringify(requestBody), signal });
  if (!response.ok) throw new Error("provider_request_failed");
  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) throw new Error("provider_empty_reply");
  return { reply: reply.trim(), model: data.model || selectedModel, usage: data.usage ? { promptTokens: data.usage.prompt_tokens || 0, completionTokens: data.usage.completion_tokens || 0, totalTokens: data.usage.total_tokens || 0 } : null };
}

export async function streamModel({ provider, env, messages, model, signal, maxTokens = 1200, temperature = 0.5, onText }) {
  const isClaude = provider === "anthropic";
  if (isClaude && !env.CLAUDE_API_KEY) throw new Error("provider_not_configured");
  const config = isClaude ? null : openAICompatibleConfig(provider, env);
  const selectedModel = modelForProvider(provider, env, model);
  const system = messages.filter(item => item.role === "system").map(item => item.content).join("\n\n");
  const conversation = messages.filter(item => item.role !== "system");
  const response = await fetch(isClaude ? "https://api.anthropic.com/v1/messages" : config.url, {
    method: "POST",
    headers: isClaude ? { "x-api-key": env.CLAUDE_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } : config.headers,
    body: JSON.stringify(isClaude ? { model: selectedModel, max_tokens: maxTokens, system, messages: conversation, stream: true } : (provider === "openai" ? { model: selectedModel, messages, max_completion_tokens: maxTokens, stream: true } : { model: selectedModel, messages, temperature, max_tokens: maxTokens, stream: true })),
    signal
  });
  if (!response.ok || !response.body) throw new Error("provider_request_failed");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", reply = "", usage = null;
  const consumeEvent = block => {
    const dataLines = block.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).replace(/^ /, ""));
    if (!dataLines.length) return;
    const raw = dataLines.join("\n").trim();
    if (!raw || raw === "[DONE]") return;
    let event; try { event = JSON.parse(raw); } catch { return; }
    let delta = "";
    if (isClaude) {
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
  return { reply: reply.trim(), model: selectedModel, usage };
}