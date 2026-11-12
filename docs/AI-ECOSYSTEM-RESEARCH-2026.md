# Houshyar AI — AI ecosystem research and product strategy

**Research snapshot:** 12 November 2026  
**Scope:** major general assistants, research/search products, coding agents, open-model ecosystems, image/video/audio tools. This is a strategic scan of representative products, not a claim to have exhaustively tested every AI product or benchmarked every model. Product availability, model names, pricing, regional access, and API terms change frequently.

## Executive decision

Houshyar should become a **model-orchestrating AI workspace**, not a thin wrapper around one chatbot. Its defensible value should be the combination of:

1. Persian-first, genuinely multilingual UX.
2. Task-aware routing across providers and specialist models.
3. Verifiable research with source links and uncertainty labels.
4. Workspace memory and project context under user control.
5. Opt-in model comparison and transparent usage/cost.
6. Safe, permissioned agents that can complete bounded workflows.
7. A unified creation area for text, code, documents, images, audio and video as provider integrations become viable.

Do not integrate every provider at once. Use provider adapters and a capability registry; activate only providers for which Houshyar has valid credentials, a supported API, a privacy review, and a tested cost ceiling.

## Competitive landscape: strengths worth learning from

| Product / ecosystem | Strong product pattern | Houshyar adaptation |
|---|---|---|
| ChatGPT | General-purpose workspace; deep research plans multi-step investigations, reads files and web sources, and returns cited reports | Research mode with a visible plan, source ledger, file context and cited final report |
| Claude | Long-form knowledge work, coding, computer-use and agent workflows; clear model tiers for speed vs. complex work | Long-context project mode, careful document editing, task decomposition and bounded agents |
| Gemini | Research across web and optionally connected Workspace sources; turns research into interactive outputs | Research plan, connected-source permissions, interactive report/export formats |
| Perplexity | Search-first answers, multiple sources, selectable models and research depth | Source-first answer cards, source quality indicators, model choice and a concise-vs-deep search distinction |
| Microsoft Copilot | Agents grounded in business data and workflows; integration into existing productivity surfaces | Workspace connectors, reusable task agents, approval steps before external actions |
| Grok | Chat plus image/video, voice, file analysis and tool connectors | A single multimodal entry point, while keeping capabilities clearly marked by provider availability |
| Qwen | Broad language, vision, audio, code and reasoning model families; open model options | Add open-weight provider choices where quality, hosting and cost justify them; strengthen multilingual coverage |
| Mistral | Model selection by use case, OCR/document intelligence, open-weight options, transcription and speech generation | Document ingestion/OCR pipeline, privacy-conscious deployment choices and specialist model routing |
| GitHub Copilot / coding agents | Repository-aware reviews, actionable diffs, custom instructions, agent handoff and required CI checks | Code workspace with repository context, test plans, review comments and human approval before merge |
| Runway and specialist visual model platforms | Dedicated models for video generation/editing, image editing, references, keyframes and synchronized audio | Separate image/video creation tools with reference assets, iterative edits and explicit provider/cost disclosure |
| ElevenLabs | Speech generation, transcription, multilingual dubbing, speaker diarization and voice agents | Voice input/output, speech-to-text, accessible spoken responses and localization workflows |

## Product capabilities to build

### P0 — core product quality (do first)

- **Task-aware model router:** classify the request (quick answer, reasoning, coding, translation, research, document extraction, creative writing) and choose a configured model by capability, latency and estimated cost.
- **Provider-neutral adapter:** standard request/response interface, timeouts, retries, structured errors, per-provider health checks and model metadata. Never expose API keys to the browser.
- **Transparent model controls:** Auto / Fast / Balanced / Deep / Creative, plus an advanced model picker only when the selected provider is configured.
- **Usage ledger:** record provider, model, prompt/output tokens, request status and estimated cost. Separate provider usage from user-billable credits; reconcile before charging.
- **Conversation/project context:** project-specific instructions, pinned files, explicit memory controls, and user-visible data retention/export/delete behavior.
- **Quality evaluation:** curated Persian/English/Arabic test sets for factuality, instruction following, coding, translation, long context, prompt injection and latency.

### P1 — high-value differentiated features

- **Model comparison:** run two configured models in parallel, show both answers side by side, disclose the additional usage, and let the user choose/merge the better answer.
- **Research mode:** first draft a plan; search multiple sources; deduplicate; track publication date and source type; cite every factual claim; distinguish verified facts from inference; export a report.
- **File intelligence:** PDF/DOCX/XLSX/PPTX ingestion, OCR for scanned pages, table extraction, grounded Q&A and citations to page/line.
- **Agent workspace:** specialized agents for research, coding, writing, translation, data analysis and business operations; agents receive only the tools and files required for their task.
- **Reusable skills/templates:** user-saved prompts and workflows, version history, sharing permissions and team templates.
- **Structured output:** create editable documents, spreadsheets, presentations, summaries and action plans from conversations.

### P2 — multimodal expansion

- Image generation/editing with reference images and iterative refinement.
- Audio transcription, speech synthesis, voice conversations and multilingual dubbing.
- Video generation/editing with storyboard, reference frames, captions and generated audio.
- OCR/document understanding with confidence scores and extraction validation.
- Real-time voice and live collaboration only after latency, consent and privacy tests.

### P3 — commercial and ecosystem capabilities

- Subscription tiers based on real provider cost and clear fair-use limits.
- Usage wallet with itemized history and no hidden conversion between provider tokens and user credits.
- Team workspaces, role-based access, shared projects and admin controls.
- Provider marketplace only after security review, API terms review, uptime monitoring and cost controls.
- Referral/rewards only with anti-abuse, financial and legal review. Do not launch a paid lottery or prize draw without jurisdiction-specific legal advice.

## What should not be copied blindly

- Do not advertise "all AI models" if only one provider is configured.
- Do not promise live search, file understanding, voice, image/video creation or external actions until each tool is integrated and tested.
- Do not let a model call arbitrary URLs, execute code, access accounts or spend money without scoped permissions and explicit approval.
- Do not store private conversations indefinitely by default. Keep retention controls and clear deletion behavior.
- Do not use model comparison as a default: it can approximately multiply inference cost and latency.
- Do not build a proprietary foundation model now. First build orchestration, UX, evaluation, trust and a stable customer base.

## Architecture recommendation

1. **Capability registry:** each provider/model declares supported modalities, languages, context size, tool support, structured output, cost metadata and operational status.
2. **Router:** map task intent + user preference + configured credentials + cost ceiling to an eligible model.
3. **Provider adapters:** independent adapters for OpenAI-compatible APIs, Anthropic-style APIs, Google APIs and specialist media APIs. Keep protocol differences out of UI code.
4. **Policy layer:** input limits, prompt-injection defenses, PII handling, tool permissions, safety rules, provider allowlists and output validation.
5. **Orchestration:** bounded agent steps, explicit state, cancellation, timeouts, retry budgets and human approval gates.
6. **Observability:** token counts, latency, provider errors, estimated cost, quality feedback and trace IDs with sensitive content excluded from logs.
7. **Evaluation:** regression tests per language and task, plus shadow tests before changing routing defaults.

## Current Houshyar implementation status

- The web interface has four response profiles: fast, balanced, deep and creative.
- These profiles use server-side Groq model environment variables; if specific variables are absent, the default model is used.
- An opt-in two-model comparison control has been added. It requires two different configured model IDs: `GROQ_MODEL_COMPARE_A` and `GROQ_MODEL_COMPARE_B`. It uses the current Groq-compatible endpoint only; it is **not yet cross-provider comparison**.
- Comparison is opt-in because it makes two inference calls. Usage totals are returned when the provider reports them; they are not yet persisted as billing records.
- Existing workspace history/projects are local browser storage, not cloud-synced.
- Production D1 accounts, quota and billing must remain disabled until database binding, migrations and secrets are verified in Cloudflare.
- No image, video, speech, web-search or third-party provider has been activated by this research document.

## Deployment checklist for the comparison feature

Set the following in Cloudflare Pages environment variables for the production environment:

- `GROQ_MODEL_COMPARE_A`: a model ID supported by the connected Groq account.
- `GROQ_MODEL_COMPARE_B`: a different supported model ID.

Keep `GROQ_API_KEY` as a secret. Do not copy API keys into source files or GitHub commits. After setting variables, deploy a new Pages build and test a normal chat request and a comparison request. GitHub Actions passing does not itself confirm a Cloudflare deployment.

## Source register

- OpenAI Deep Research: https://help.openai.com/en/articles/10500283-deep-research
- Gemini Deep Research: https://gemini.google/overview/deep-research/
- Perplexity Pro Search: https://www.perplexity.ai/help-center/en/articles/10352903-what-is-pro-search
- Anthropic model updates: https://www.anthropic.com/news/models
- xAI Grok overview: https://docs.x.ai/grok/overview
- Qwen model ecosystem: https://qwen.moe/
- Mistral model catalogue: https://docs.mistral.ai/models
- Mistral OCR 4: https://mistral.ai/news/ocr-4/
- GitHub Copilot Code Review: https://github.com/features/copilot/code-review
- Runway model catalogue: https://dev.runwayml.com/models/catalog
- ElevenLabs API capabilities: https://elevenlabs.io/docs/overview/intro
- ElevenLabs dubbing: https://elevenlabs.io/docs/overview/capabilities/dubbing

**Method note:** vendor documentation describes advertised capabilities, not independent proof of quality. Before selecting a default model, run Houshyar's own Persian and multilingual evaluation set and compare quality, latency, reliability, API availability, licensing and total cost.
