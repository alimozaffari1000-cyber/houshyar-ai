const CLAUDE_DEFAULT_MODEL = "claude-sonnet-5-5";

export function listAvailableProviders(env = {}) {
  return [
    { id: "groq", available: Boolean(env.GROQ_API_KEY), defaultModel: env.GROQ_MODEL || "llama-3.3-70b-versatile" },
    { id: "anthropic", available: Boolean(env.CLAUDE_API_KEY), defaultModel: env.CLAUDE_MODEL || CLAUDE_DEFAULT_MODEL }
  ];
}

export function resolveProvider(env = {}, requested = "auto", mode = "balanced") {
  const available = listAvailableProviders(env);
  const requestedId = ["groq", "anthropic"].includes(requested) ? requested : "auto";
  const selected = requestedId === "auto"
    ? (mode === "deep" && env.CLAUDE_API_KEY ? "anthropic" : (env.AI_DEFAULT_PROVIDER || "groq"))
    : requestedId;
  const provider = available.find(item => item.id === selected);
  if (!provider?.available) return { error: "PROVIDER_NOT_CONFIGURED", provider: selected };
  return { provider: selected, model: provider.defaultModel };
}

export async function requestModel({ provider, env, messages, model, signal, maxTokens = 1200, temperature = 0.5 }) {
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
      body: JSON.stringify({
        model: model || env.CLAUDE_MODEL || CLAUDE_DEFAULT_MODEL,
        max_tokens: maxTokens,
        temperature,
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
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens || 0,
        completionTokens: data.usage.output_tokens || 0,
        totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
      } : null
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
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens || 0,
      completionTokens: data.usage.completion_tokens || 0,
      totalTokens: data.usage.total_tokens || 0
    } : null
  };
}
