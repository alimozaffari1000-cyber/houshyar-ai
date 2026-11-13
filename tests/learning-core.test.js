import test from "node:test";
import assert from "node:assert/strict";
import {
  clearLearningFeedback,
  getLearningStats,
  recordLearningFeedback
} from "../src/learning-core.js";

const STORAGE_KEY = "houshyar.learning.feedback.v1";

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("learning feedback persists only minimal metadata, never message content", () => {
  const storage = new MemoryStorage();
  const privateMessage = "private user message must not be retained";
  const privateAnswer = "private assistant answer must not be retained";

  assert.equal(recordLearningFeedback({
    responseId: "response-privacy-1",
    category: "general",
    mode: "balanced",
    rating: 1,
    message: privateMessage,
    answer: privateAnswer
  }, storage), true);

  const records = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(records.length, 1);
  assert.deepEqual(Object.keys(records[0]).sort(), [
    "category", "createdAt", "mode", "rating", "responseId"
  ]);
  assert.equal(JSON.stringify(records).includes(privateMessage), false);
  assert.equal(JSON.stringify(records).includes(privateAnswer), false);
});

test("a repeated response feedback replaces the prior record instead of duplicating it", () => {
  const storage = new MemoryStorage();
  const responseId = "response-repeat-1";

  assert.equal(recordLearningFeedback({
    responseId, category: "research", mode: "fast", rating: 0
  }, storage), true);
  assert.equal(recordLearningFeedback({
    responseId, category: "research", mode: "deep", rating: 1
  }, storage), true);

  const records = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(records.length, 1);
  assert.equal(records[0].mode, "deep");
  assert.equal(records[0].rating, 1);
  assert.deepEqual(getLearningStats("research", storage).byMode.deep, {
    count: 1,
    positive: 1
  });
});

test("learning feedback retention is capped at 300 records", () => {
  const storage = new MemoryStorage();

  for (let index = 0; index < 301; index += 1) {
    assert.equal(recordLearningFeedback({
      responseId: `response-${index}`,
      category: "general",
      mode: "balanced",
      rating: index % 2
    }, storage), true);
  }

  const records = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(records.length, 300);
  assert.equal(records[0].responseId, "response-1");
  assert.equal(records.at(-1).responseId, "response-300");
});

test("learning feedback can be cleared from local storage", () => {
  const storage = new MemoryStorage();
  recordLearningFeedback({
    responseId: "response-clear-1",
    category: "general",
    mode: "balanced",
    rating: 1
  }, storage);

  assert.equal(clearLearningFeedback(storage), true);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(getLearningStats(null, storage).total, 0);
});

test("malformed or unavailable local storage fails safely", () => {
  const malformed = new MemoryStorage();
  malformed.setItem(STORAGE_KEY, "{not valid JSON");
  assert.equal(getLearningStats(null, malformed).total, 0);

  const unavailable = {
    getItem() { throw new Error("storage unavailable"); },
    setItem() { throw new Error("storage unavailable"); },
    removeItem() { throw new Error("storage unavailable"); }
  };
  assert.equal(recordLearningFeedback({
    responseId: "response-storage-error",
    category: "general",
    mode: "balanced",
    rating: 1
  }, unavailable), false);
  assert.equal(clearLearningFeedback(unavailable), false);
});
