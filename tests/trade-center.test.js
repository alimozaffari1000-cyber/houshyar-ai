import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("trade center is linked from the home screen and initialized", async () => {
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const ui = await readFile(new URL("../src/trade-center.js", import.meta.url), "utf8");
  assert.ok(main.includes("initTradeCenter"));
  assert.ok(main.includes("data-open-trade-center"));
  assert.ok(ui.includes("/api/trade/requests"));
  assert.ok(ui.includes("/api/trade/offers"));
  assert.ok(ui.includes("/api/trade/messages"));
});

test("trade center requires explicit supplier-sharing consent and escapes server data", async () => {
  const ui = await readFile(new URL("../src/trade-center.js", import.meta.url), "utf8");
  assert.ok(ui.includes("shareWithSuppliers"));
  assert.ok(ui.includes("form.elements.shareWithSuppliers.checked"));
  assert.ok(ui.includes("const esc="));
});

test("trade center parses currency amounts into exact minor units", async () => {
  const ui = await readFile(new URL("../src/trade-center.js", import.meta.url), "utf8");
  assert.ok(ui.includes("parseMajorAmount(v.price,v.currency)"));
  assert.ok(ui.includes("formatMinorAmount"));
  assert.ok(ui.includes("تبدیل خودکار ارز وجود ندارد"));
});

test("trade center keeps negotiation distinct from orders and payments", async () => {
  const ui = await readFile(new URL("../src/trade-center.js", import.meta.url), "utf8");
  assert.ok(ui.includes("maxlength=\"2000\""));
  assert.ok(ui.includes("سفارش، قرارداد یا پرداخت ایجاد نمی‌کند"));
});
