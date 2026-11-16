const MAX_CONVERSATIONS = 40;
const MAX_MESSAGES_PER_CONVERSATION = 30;
const MAX_MESSAGE_CHARS = 6000;
const MAX_TITLE_CHARS = 56;

export function normalizeChatHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => item && typeof item === "object" && !Array.isArray(item) &&
      typeof item.id === "string" && item.id.length > 0 && item.id.length <= 128 &&
      Array.isArray(item.messages))
    .map(item => {
      const messages = item.messages
        .filter(message => message && typeof message === "object" &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.text === "string" && message.text.trim())
        .slice(-MAX_MESSAGES_PER_CONVERSATION)
        .map(message => ({
          role: message.role,
          text: message.text.slice(0, MAX_MESSAGE_CHARS),
          agent: message.agent && typeof message.agent === "object"
            ? { id: String(message.agent.id || "").slice(0, 48), label: String(message.agent.label || "").slice(0, 80) }
            : null,
          collaboration: message.collaboration && typeof message.collaboration === "object"
            ? { enabled: message.collaboration.enabled === true, status: ["completed", "partial"].includes(message.collaboration.status) ? message.collaboration.status : "unknown" }
            : null
        }));
      return {
        id: item.id,
        title: String(item.title || "گفتگو").replace(/\\s+/g, " ").slice(0, MAX_TITLE_CHARS),
        messages,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt.slice(0, 40) : ""
      };
    })
    .filter(item => item.messages.length > 0)
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedAt);
      const bTime = Date.parse(b.updatedAt);
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })
    .slice(0, MAX_CONVERSATIONS);
}
