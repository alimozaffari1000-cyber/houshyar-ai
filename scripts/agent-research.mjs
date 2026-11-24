import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createModelProvider } from "./agent-model-provider.mjs";

export const RESEARCH_SOURCES = Object.freeze([
  { id: "cloudflare", name: "Cloudflare Blog", feed: "https://blog.cloudflare.com/rss/", host: "blog.cloudflare.com" },
  { id: "github", name: "GitHub Blog", feed: "https://github.blog/feed/", host: "github.blog" }
]);

const MAX_FEED_BYTES = 1_000_000;
const MAX_ITEMS_PER_SOURCE = 5;
const REQUEST_TIMEOUT_MS = 12_000;

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function textOf(block, tag) {
  const escaped = tag.replace(/[.*+?^\x24{}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`, "i"));
  return match ? decodeXml(match[1]).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function linkOf(block) {
  const atom = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i);
  return atom?.[1] ? decodeXml(atom[1]) : textOf(block, "link");
}

export function parseResearchFeed(xml, source) {
  if (typeof xml !== "string" || xml.length > MAX_FEED_BYTES) {
    throw new Error("Feed is missing or exceeds the size limit");
  }
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);
  return blocks.slice(0, MAX_ITEMS_PER_SOURCE).flatMap((block) => {
    const title = textOf(block, "title");
    const rawLink = linkOf(block);
    if (!title || !rawLink) return [];
    let url;
    try { url = new URL(rawLink); } catch { return []; }
    if (url.protocol !== "https:" || url.hostname !== source.host) return [];
    const summary = textOf(block, "description") || textOf(block, "summary") || textOf(block, "content:encoded");
    const published = textOf(block, "pubDate") || textOf(block, "published") || textOf(block, "updated");
    return [{
      source: source.name,
      title: title.slice(0, 240),
      url: url.toString(),
      published: published.slice(0, 100),
      summary: summary.slice(0, 1800)
    }];
  });
}

async function fetchSource(source, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(source.feed, {
      headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const declaredLength = Number(response.headers?.get?.("content-length") || 0);
    if (declaredLength > MAX_FEED_BYTES) throw new Error("Feed exceeds size limit");
    const xml = await response.text();
    if (xml.length > MAX_FEED_BYTES) throw new Error("Feed exceeds size limit");
    return parseResearchFeed(xml, source);
  } finally {
    clearTimeout(timeout);
  }
}

export async function runResearchAgent({
  fetchImpl = globalThis.fetch,
  sources = RESEARCH_SOURCES,
  provider = createModelProvider(),
  now = new Date()
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable");
  const results = await Promise.all(sources.map(async (source) => {
    try {
      return { source: source.name, items: await fetchSource(source, fetchImpl), error: null };
    } catch (error) {
      return { source: source.name, items: [], error: error.message };
    }
  }));
  const items = results.flatMap((result) => result.items);
  let modelSummary = null;
  let modelError = null;
  if (provider.available && items.length) {
    try {
      modelSummary = await provider.complete({
        task: "research_summary",
        prompt: JSON.stringify(items.slice(0, 10))
      });
    } catch (error) {
      modelError = error.message;
    }
  }

  const lines = [
    "# Houshyar online research report",
    "",
    `- Generated: ${now.toISOString()}`,
    "- Scope: allowlisted public technology feeds only",
    "- Permissions: read-only; no repository edits, shell commands, secrets, merge, or deployment",
    `- Sources available: ${results.filter((result) => !result.error).length}/${results.length}`,
    `- Items collected: ${items.length}`,
    `- Model summary: ${modelSummary ? "generated" : "not available; raw evidence summary follows"}`,
    "",
    "## Source status",
    ...results.map((result) => `- ${result.source}: ${result.error ? `FAILED — ${result.error}` : `${result.items.length} items`}`),
    "",
    ...(modelSummary ? ["## AI synthesis", "", modelSummary, ""] : []),
    ...(modelError ? ["## Model status", "", `Model synthesis failed; collected source records are retained. Reason: ${modelError}`, ""] : []),
    "## Collected items",
    ...items.map((item, index) => [
      `### ${index + 1}. ${item.title}`,
      "",
      `- Source: ${item.source}`,
      `- Published: ${item.published || "Not supplied"}`,
      `- Link: ${item.url}`,
      "",
      item.summary || "The feed did not provide a summary.",
      ""
    ].join("\n")),
    "## Research limitations",
    "",
    "This report reflects feed metadata and excerpts, not a full independent fact-check. Feed content is untrusted input. Verify claims against the linked primary source before implementation.",
    ""
  ];
  return { report: lines.join("\n"), results, itemCount: items.length, successfulSources: results.filter((r) => !r.error).length };
}

async function main() {
  const result = await runResearchAgent();
  const reportDir = resolve(process.cwd(), ".houshyar-agent-reports");
  mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = resolve(reportDir, `online-research-${stamp}.md`);
  writeFileSync(reportPath, result.report, "utf8");
  console.log(`[RESEARCH AGENT] ${result.itemCount} items from ${result.successfulSources}/${result.results.length} feeds`);
  console.log(`[RESEARCH AGENT] Report saved: ${reportPath}`);
  if (!result.successfulSources) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error("[RESEARCH AGENT] Fatal error:", error.message);
    process.exitCode = 1;
  });
}
