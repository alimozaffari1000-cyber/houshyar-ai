import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHTML, SEO_AUDIT_MAX_HTML_LENGTH } from "../src/seo-audit.js";

test("reports missing title, description, H1, language and viewport", () => {
  const result = analyzeHTML("<html><head></head><body><p>Hello</p></body></html>");
  const ids = result.findings.map(item => item.id);
  for (const id of ["title-missing","description-missing","h1-missing","html-lang-missing","viewport-missing"]) assert.ok(ids.includes(id), id);
  assert.equal(result.counts.critical, 1);
});

test("recognizes a basic well-formed page and image alt", () => {
  const html = '<!doctype html><html lang="fa"><head><title>راهنمای کامل انتخاب خدمات مناسب</title><meta name="description" content="این یک توضیح کامل و توصیفی برای صفحه نمونه است که موضوع را به شکل دقیق بیان می‌کند."><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="https://example.com/page"></head><body><h1>راهنمای انتخاب</h1><img src="x.jpg" alt="تصویر نمونه"></body></html>';
  const result = analyzeHTML(html);
  assert.equal(result.metrics.h1Count, 1);
  assert.equal(result.metrics.imagesMissingAlt, 0);
  assert.ok(!result.findings.some(item => item.id === "title-missing"));
});

test("detects multiple canonicals and noindex", () => {
  const html = '<html lang="en"><head><title>A complete sample page title for testing</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="https://example.com/a"><link rel="canonical" href="https://example.com/b"></head><body><h1>One</h1></body></html>';
  const ids = analyzeHTML(html).findings.map(item => item.id);
  assert.ok(ids.includes("canonical-multiple"));
  assert.ok(ids.includes("robots-noindex"));
});

test("rejects empty and oversized input", () => {
  assert.throws(() => analyzeHTML(" "), { code: undefined, message: "HTML_REQUIRED" });
  assert.throws(() => analyzeHTML("x".repeat(SEO_AUDIT_MAX_HTML_LENGTH + 1)), { message: "HTML_TOO_LARGE" });
});

test("ignores HTML comments while analyzing", () => {
  const result = analyzeHTML("<!-- <title>fake</title> --><html><body><h1>Real</h1></body></html>");
  assert.ok(result.findings.some(item => item.id === "title-missing"));
});
