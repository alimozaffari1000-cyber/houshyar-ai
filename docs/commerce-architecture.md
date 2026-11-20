# Houshyar Commerce — staged implementation plan

## Product objective
Houshyar Commerce will let a small merchant create a branded online store, manage a catalogue and inventory, receive orders, and optionally offer AI-assisted virtual garment previews. The first vertical is fashion/apparel; the underlying commerce model should support other merchant categories.

## Current prototype status
The first UI prototype is intentionally local-only:
- Store profile and product drafts are stored in browser localStorage on the current device.
- Product cards and a demo cart are interactive.
- The try-on screen accepts a temporary local photo preview only.
- There is no server-side merchant account, database persistence, real checkout, payment processing, order fulfillment, or AI image generation yet.
- Never market this prototype as a live store or working virtual try-on.

## Recommended architecture
- Cloudflare Pages Functions for authenticated server APIs.
- D1 for merchants, stores, memberships, products, variants, inventory, carts, orders, order items, coupons, and audit events.
- R2 for product images and private try-on input/output objects, with signed upload/download flows.
- Strict tenant authorization on every merchant-owned query and mutation. Never trust a client-supplied merchant/store ID without checking membership.
- Payment adapter interface. Begin with sandbox/test orders and, where legally suitable, manual confirmation or cash on delivery. Add gateways only after merchant-country eligibility, settlement, chargeback, tax and sanctions requirements are reviewed.
- Background job/status abstraction for image generation. Provider credentials stay server-side. Add explicit consent, upload validation, moderation, rate limits, per-store quotas, cost accounting, short retention, and deletion.
- AI try-on images are visual estimates, not a guarantee of garment size, fit, texture or exact appearance. Keep measurement charts and return policy visible.

## Core data model
- users(id, email, ...)
- merchants(id, owner_user_id, status, created_at)
- stores(id, merchant_id, slug, name, category, locale, currency, theme_json, policy_json, status)
- products(id, store_id, title, description, status)
- product_variants(id, product_id, sku, size, color, price_minor, currency, stock_qty)
- product_media(id, product_id, r2_key, media_type, sort_order)
- carts(id, customer_session_hash, store_id, expires_at)
- cart_items(id, cart_id, variant_id, quantity)
- orders(id, store_id, customer_id nullable, status, subtotal_minor, shipping_minor, total_minor, currency, payment_status, created_at)
- order_items(id, order_id, variant_id, product_snapshot_json, quantity, unit_price_minor)
- tryon_jobs(id, user_id nullable, store_id, provider, status, input_keys, output_key, cost_minor nullable, expires_at, consent_at)

## Delivery gates
1. Confirm D1 binding and migrations in a non-production environment.
2. Implement merchant/store APIs with authentication, ownership checks and tests.
3. Implement catalogue CRUD and image upload through R2.
4. Build public storefront, cart and sandbox order flow.
5. Implement inventory reservation and order lifecycle; add notifications after delivery channel configuration.
6. Evaluate commercial try-on providers for rights, price, quality, latency, data retention and regional availability.
7. Implement try-on only through server-side provider adapter and private object storage.
8. Run QA, security scan, tenant-isolation tests and end-to-end browser tests before release.

## Non-goals for the first release
- Acting as a bank, exchange, escrow provider or payment processor.
- Promising exact body measurements or fit from generated images.
- Storing personal try-on photos indefinitely or using them for training by default.
- Supporting every country/payment gateway before legal and operational review.
