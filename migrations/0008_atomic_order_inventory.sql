-- Commit product stock only when a seller accepts an order.
-- Requests remain unreserved until acceptance, so abandoned requests cannot lock stock.
-- Apply and validate on staging only; do not apply to production as part of this change.
PRAGMA foreign_keys = ON;

CREATE TRIGGER IF NOT EXISTS trg_marketplace_order_accept_inventory
BEFORE UPDATE OF status ON marketplace_orders
WHEN OLD.status = 'requested' AND NEW.status = 'accepted'
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM marketplace_order_items WHERE order_id = NEW.id
    )
    THEN RAISE(ABORT, 'ORDER_ITEMS_MISSING')
  END;

  UPDATE products
  SET stock_count = stock_count - (
    SELECT SUM(i.quantity)
    FROM marketplace_order_items i
    WHERE i.order_id = NEW.id AND i.product_id = products.id
  ),
  updated_at = NEW.updated_at
  WHERE id IN (
    SELECT DISTINCT product_id
    FROM marketplace_order_items
    WHERE order_id = NEW.id
  )
  AND store_id = NEW.store_id
  AND status = 'published'
  AND EXISTS (
    SELECT 1 FROM merchant_stores s
    WHERE s.id = products.store_id AND s.status = 'active'
  )
  AND stock_count >= (
    SELECT SUM(i.quantity)
    FROM marketplace_order_items i
    WHERE i.order_id = NEW.id AND i.product_id = products.id
  );

  SELECT CASE
    WHEN changes() != (
      SELECT COUNT(DISTINCT product_id)
      FROM marketplace_order_items
      WHERE order_id = NEW.id
    )
    THEN RAISE(ABORT, 'INSUFFICIENT_ORDER_STOCK')
  END;
END;
