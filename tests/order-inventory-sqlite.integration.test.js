import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";

const migrationFiles = Array.from({ length: 8 }, (_, i) =>
  new URL(`../migrations/${String(i + 1).padStart(4, "0")}_${[
    "identity_usage_security",
    "daily_usage_quotas",
    "email_verification_password_reset",
    "marketplace_foundation",
    "visual_try_on_foundation",
    "local_store_discovery",
    "marketplace_orders",
    "atomic_order_inventory"
  ][i]}.sql`, import.meta.url)
);

async function makeDatabase() {
  const db = new DatabaseSync(":memory:");
  for (const migration of migrationFiles) {
    db.exec(await readFile(migration, "utf8"));
  }
  db.exec(`
    INSERT INTO users(id,email_normalized,password_hash,password_salt,created_at,updated_at)
    VALUES ('seller-1','seller1@example.test','hash','salt',1,1),
           ('seller-2','seller2@example.test','hash','salt',1,1),
           ('buyer-1','buyer@example.test','hash','salt',1,1)
  `);
  db.exec(`
    INSERT INTO merchant_stores(id,user_id,name,slug,status,created_at,updated_at)
    VALUES ('store-1','seller-1','Store One','store-one','active',1,1),
           ('store-2','seller-2','Store Two','store-two','active',1,1);
    INSERT INTO products(id,store_id,title,slug,category,price_minor,currency_code,stock_count,status,created_at,updated_at)
    VALUES ('product-1','store-1','Product One','product-one','general',100,'EUR',1,'published',1,1),
           ('product-2','store-2','Product Two','product-two','general',100,'EUR',5,'published',1,1);
  `);
  return db;
}

function addOrder(db, { id, storeId = "store-1", productId = "product-1", quantity = 1 }) {
  db.prepare(`
    INSERT INTO marketplace_orders
      (id,buyer_id,store_id,customer_name,customer_phone,fulfillment,status,total_minor,currency_code,created_at,updated_at)
    VALUES (?, 'buyer-1', ?, 'Buyer', '1234567', 'pickup', 'requested', ?, 'EUR', 1, 1)
  `).run(id, storeId, 100 * quantity);
  db.prepare(`
    INSERT INTO marketplace_order_items
      (id,order_id,product_id,product_title,quantity,unit_price_minor,line_total_minor)
    VALUES (?, ?, ?, 'Product', ?, 100, ?)
  `).run("item-" + id, id, productId, quantity, 100 * quantity);
}

test("SQLite integration: competing sellers cannot both accept the last unit", async () => {
  const db = await makeDatabase();
  try {
    addOrder(db, { id: "order-a" });
    addOrder(db, { id: "order-b" });

    db.prepare("UPDATE marketplace_orders SET status='accepted', updated_at=2 WHERE id='order-a'").run();
    assert.throws(
      () => db.prepare("UPDATE marketplace_orders SET status='accepted', updated_at=3 WHERE id='order-b'").run(),
      /INSUFFICIENT_ORDER_STOCK/
    );

    assert.equal(db.prepare("SELECT stock_count AS n FROM products WHERE id='product-1'").get().n, 0);
    assert.equal(db.prepare("SELECT status FROM marketplace_orders WHERE id='order-a'").get().status, "accepted");
    assert.equal(db.prepare("SELECT status FROM marketplace_orders WHERE id='order-b'").get().status, "requested");
  } finally {
    db.close();
  }
});

test("SQLite integration: failed multi-product acceptance rolls back every stock update", async () => {
  const db = makeDatabase();
  try {
    db.prepare("UPDATE products SET stock_count=3 WHERE id='product-1'").run();
    db.prepare("UPDATE products SET stock_count=0 WHERE id='product-2'").run();
    db.prepare(`
      INSERT INTO marketplace_orders
        (id,buyer_id,store_id,customer_name,customer_phone,fulfillment,status,total_minor,currency_code,created_at,updated_at)
      VALUES ('order-multi','buyer-1','store-1','Buyer','1234567','pickup','requested',200,'EUR',1,1)
    `).run();
    db.prepare(`
      INSERT INTO marketplace_order_items
        (id,order_id,product_id,product_title,quantity,unit_price_minor,line_total_minor)
      VALUES ('item-multi-a','order-multi','product-1','Product One',1,100,100),
             ('item-multi-b','order-multi','product-2','Product Two',1,100,100)
    `).run();
    await applyInventoryMigration(db);

    assert.throws(
      () => db.prepare("UPDATE marketplace_orders SET status='accepted' WHERE id='order-multi'").run(),
      /INSUFFICIENT_ORDER_STOCK/
    );
    assert.equal(db.prepare("SELECT stock_count AS n FROM products WHERE id='product-1'").get().n, 3);
    assert.equal(db.prepare("SELECT status FROM marketplace_orders WHERE id='order-multi'").get().status, "requested");
  } finally {
    db.close();
  }
});

test("SQLite integration: rejection and completion never cause a second stock deduction", async () => {
  const db = makeDatabase();
  try {
    addOrder(db, { id: "order-rejected" });
    addOrder(db, { id: "order-accepted" });
    await applyInventoryMigration(db);

    db.prepare("UPDATE marketplace_orders SET status='rejected' WHERE id='order-rejected'").run();
    assert.equal(db.prepare("SELECT stock_count AS n FROM products WHERE id='product-1'").get().n, 1);

    db.prepare("UPDATE marketplace_orders SET status='accepted' WHERE id='order-accepted'").run();
    db.prepare("UPDATE marketplace_orders SET status='completed' WHERE id='order-accepted'").run();
    db.prepare("UPDATE marketplace_orders SET status='accepted' WHERE id='order-accepted'").run();
    assert.equal(db.prepare("SELECT stock_count AS n FROM products WHERE id='product-1'").get().n, 0);
  } finally {
    db.close();
  }
});

test("SQLite integration: order items cannot deduct stock from another seller's store", async () => {
  const db = makeDatabase();
  try {
    addOrder(db, { id: "order-cross-store", storeId: "store-1", productId: "product-2" });
    await applyInventoryMigration(db);
    assert.throws(
      () => db.prepare("UPDATE marketplace_orders SET status='accepted' WHERE id='order-cross-store'").run(),
      /INSUFFICIENT_ORDER_STOCK/
    );
    assert.equal(db.prepare("SELECT stock_count AS n FROM products WHERE id='product-2'").get().n, 5);
    assert.equal(db.prepare("SELECT status FROM marketplace_orders WHERE id='order-cross-store'").get().status, "requested");
  } finally {
    db.close();
  }
});
