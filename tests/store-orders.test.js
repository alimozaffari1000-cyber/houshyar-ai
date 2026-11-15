import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("seller order endpoint scopes reads and status updates to the authenticated active store", async () => {
  const source = await readFile(new URL("../functions/api/store/orders.js", import.meta.url), "utf8");
  assert.match(source, /getSessionUser/);
  assert.match(source, /originAllowed/);
  assert.match(source, /WHERE o\.store_id = \?/);
  assert.match(source, /WHERE id = \? AND store_id = \? AND status = \?/);
  assert.match(source, /\["accepted", "rejected", "completed"\]/);
  assert.match(source, /ORDER_STATUS_CONFLICT/);
});
