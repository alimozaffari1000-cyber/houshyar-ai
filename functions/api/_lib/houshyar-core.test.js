import test from "node:test";
import assert from "node:assert/strict";
import { buildCoreContext, detectResponseLanguage, getCoreCapabilities, HOUSHYAR_CORE_VERSION } from "./houshyar-core.js";

test("detects Persian and English response languages", () => {
  assert.equal(detectResponseLanguage("سلام، حالت چطوره؟"), "fa");
  assert.equal(detectResponseLanguage("Hello, how are you?"), "en");
});

test("routes specialist requests and normalizes execution mode", () => {
  const context = buildCoreContext({ message: "این متن را به انگلیسی ترجمه کن", mode: "invalid" });
  assert.equal(context.agent.id, "translator");
  assert.equal(context.language, "fa");
  assert.equal(context.mode, "balanced");
  assert.match(context.systemInstruction, /Houshyar Core/);
});

test("exposes honest orchestration capability metadata", () => {
  assert.equal(HOUSHYAR_CORE_VERSION, "1.0.0");
  assert.equal(getCoreCapabilities().independentBaseModel, false);
});
