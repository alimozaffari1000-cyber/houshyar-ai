import test from "node:test";
import assert from "node:assert/strict";
import { parseResearchFeed, runResearchAgent } from "../scripts/agent-research.mjs";

const source = { name: "Test Feed", host: "updates.example.test" };

test("parses RSS safely and rejects links outside the source host", () => {
  const xml = `<rss><channel>
    <item><title>Safe update</title><link>https://updates.example.test/post</link><description><![CDATA[Useful <b>summary</b>]]></description><pubDate>Tue, 18 Nov 2026 10:00:00 GMT</pubDate></item>
    <item><title>External link</title><link>https://attacker.example/post</link></item>
  </channel></rss>`;
  const items = parseResearchFeed(xml, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Safe update");
  assert.match(items[0].summary, /Useful summary/);
});

test("caps feed size and item count", () => {
  assert.throws(() => parseResearchFeed("x".repeat(1_000_001), source), /size limit/);
  const items = Array.from({ length: 8 }, (_, i) =>
    `<item><title>Update ${i}</title><link>https://updates.example.test/${i}</link></item>`
  ).join("");
  assert.equal(parseResearchFeed(`<rss>${items}</rss>`, source).length, 5);
});

test("research agent produces source-linked report and continues when one feed fails", async () => {
  const sources = [
    { name: "Good", host: "good.example.test", feed: "https://good.example.test/feed" },
    { name: "Bad", host: "bad.example.test", feed: "https://bad.example.test/feed" }
  ];
  const result = await runResearchAgent({
    sources,
    provider: { available: false },
    now: new Date("2026-11-18T12:00:00.000Z"),
    fetchImpl: async (url) => {
      if (url.includes("bad.")) throw new Error("network unavailable");
      return {
        ok: true,
        headers: { get: () => "120" },
        text: async () => "<rss><item><title>Release notes</title><link>https://good.example.test/release</link><description>New features</description></item></rss>"
      };
    }
  });
  assert.equal(result.successfulSources, 1);
  assert.equal(result.itemCount, 1);
  assert.match(result.report, /https:\/\/good.example.test\/release/);
  assert.match(result.report, /network unavailable/);
  assert.match(result.report, /not available/);
});

test("research agent can use optional model summary", async () => {
  const result = await runResearchAgent({
    sources: [{ name: "Good", host: "good.example.test", feed: "https://good.example.test/feed" }],
    provider: { available: true, complete: async ({ task }) => { assert.equal(task, "research_summary"); return "Prioritized synthesis"; } },
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => null },
      text: async () => "<rss><item><title>Update</title><link>https://good.example.test/update</link></item></rss>"
    })
  });
  assert.match(result.report, /Prioritized synthesis/);
});
