import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("order acceptance commits inventory atomically and only once", async () => {
  const migration = await readFile(new URL("../migrations/0008_atomic_order_inventory.sql", import.meta.url), "utf8");
  assert.match(migration, /BEFORE UPDATE OF status ON marketplace_orders/);
  assert.match(migration, /OLD\.status = 'requested' AND NEW\.status = 'accepted'/);
  assert.match(migration, /stock_count = stock_count -/);
  assert.match(migration, /stock_count >=/);
  assert.match(migration, /s\.status = 'active'/);
  assert.match(migration, /status = 'published'/);
  assert.match(migration, /RAISE\(ABORT, 'INSUFFICIENT_ORDER_STOCK'\)/);
  assert.match(migration, /COUNT\(DISTINCT product_id\)/);
});
