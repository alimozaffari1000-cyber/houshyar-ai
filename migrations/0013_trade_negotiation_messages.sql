-- Private buyer-supplier negotiation threads. Messages are not orders or contracts.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trade_negotiation_threads (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES trade_purchase_requests(id) ON DELETE CASCADE,
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplier_store_id TEXT NOT NULL REFERENCES merchant_stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(request_id, supplier_store_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_negotiation_threads_buyer
  ON trade_negotiation_threads(buyer_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_negotiation_threads_supplier
  ON trade_negotiation_threads(supplier_store_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS trade_negotiation_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES trade_negotiation_threads(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trade_negotiation_messages_thread
  ON trade_negotiation_messages(thread_id, created_at ASC);
