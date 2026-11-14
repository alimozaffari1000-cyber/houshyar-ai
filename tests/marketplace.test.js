import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKET_COUNTRIES, MARKET_CURRENCIES, MARKET_CATEGORIES, validCountry, cleanText, validSlug } from '../functions/api/_lib/marketplace.js';
import { readFile } from 'node:fs/promises';

test('market configuration only accepts explicitly enabled country markets', () => {
  assert.deepEqual([...MARKET_COUNTRIES].sort(), ['AE','DE','IR','TR']);
  for (const code of MARKET_COUNTRIES) assert.equal(validCountry(code.toLowerCase()), true);
  for (const code of ['US','RU','',null,42]) assert.equal(validCountry(code), false);
  assert.deepEqual(MARKET_CURRENCIES, { IR:'IRR', AE:'AED', DE:'EUR', TR:'TRY' });
});

test('market listing categories are allow-listed', () => {
  for (const category of ['goods','property','vehicles','jobs','services','fashion']) assert.equal(MARKET_CATEGORIES.has(category), true);
  assert.equal(MARKET_CATEGORIES.has('payments'), false);
});

test('marketplace text and store slugs are bounded and validated', () => {
  assert.equal(cleanText('  Tehran  ', 2, 100), 'Tehran');
  assert.equal(cleanText('x', 2, 100), null);
  assert.equal(cleanText('x'.repeat(101), 2, 100), null);
  assert.equal(validSlug('my-store-1'), true);
  assert.equal(validSlug('My Store'), false);
  assert.equal(validSlug('../admin'), false);
});

test('country marketplace schema enforces country ownership and moderation states', async () => {
  const sql = await readFile(new URL('../migrations/0010_country_marketplace.sql', import.meta.url), 'utf8');
  assert.match(sql, /country_code TEXT NOT NULL CHECK \(country_code IN \('IR','AE','DE','TR'\)\)/);
  assert.match(sql, /owner_user_id TEXT NOT NULL REFERENCES users\(id\)/);
  assert.match(sql, /status TEXT NOT NULL DEFAULT 'pending'/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_market_listings_country_status_category/);
  assert.match(sql, /price_amount INTEGER CHECK \(price_amount IS NULL OR price_amount >= 0\)/);
  assert.doesNotMatch(sql, /price_minor/);
});

test('marketplace public listing endpoint filters by country and approved state', async () => {
  const source = await readFile(new URL('../functions/api/market/listings.js', import.meta.url), 'utf8');
  assert.match(source, /l\.country_code = \?/);
  assert.match(source, /l\.status = 'published'/);
  assert.match(source, /s\.status = 'active'/);
  assert.match(source, /getSessionUser|requireMarketUser/);
  assert.match(source, /originAllowed/);
});

test('seller store listing is scoped to authenticated owner', async () => {
  const source = await readFile(new URL('../functions/api/market/my-stores.js', import.meta.url), 'utf8');
  assert.match(source, /requireMarketUser/);
  assert.match(source, /WHERE owner_user_id = \?/);
});

test('moderation requires admin and publishes only in the matching country', async () => {
  const source = await readFile(new URL('../functions/api/market/moderate.js', import.meta.url), 'utf8');
  assert.match(source, /auth\.user\.role !== "admin"/);
  assert.match(source, /country_code = \?/);
  assert.match(source, /STORE_NOT_ACTIVE/);
  assert.match(source, /marketplace\.moderated/);
});


test('seller workspace is mounted and uses authenticated marketplace APIs', async () => {
  const seller = await readFile(new URL('../src/market-seller.js', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /initMarketSeller\(app, getLocale\)/);
  assert.match(main, /market-seller-root/);
  assert.match(seller, /\/api\/market\/my-stores/);
  assert.match(seller, /\/api\/market\/stores/);
  assert.match(seller, /\/api\/market\/listings/);
  assert.match(seller, /country:selectedCountry/);
  assert.match(seller, /const storeId=fd\.get\('storeId'\)/);
  assert.match(seller, /AUTH_REQUIRED|status===401/);
  assert.match(seller, /aria-live="polite"/);
});


test('moderation queue is admin-only and country-scoped', async () => {
  const source = await readFile(new URL('../functions/api/market/moderation-queue.js', import.meta.url), 'utf8');
  assert.match(source, /auth\.user\.role !== "admin"/);
  assert.match(source, /validCountry\(country\)/);
  assert.match(source, /status = 'pending'/);
  assert.match(source, /country_code = \?/);
  assert.doesNotMatch(source, /owner_user_id|email/);
});

test('moderation dashboard is mounted and uses protected moderation endpoints', async () => {
  const admin = await readFile(new URL('../src/market-admin.js', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /initMarketAdmin\(app, getLocale\)/);
  assert.match(main, /market-admin-root/);
  assert.match(admin, /\/api\/market\/moderation-queue\?country=/);
  assert.match(admin, /\/api\/market\/moderate/);
  assert.match(admin, /data-decision="approve"/);
  assert.match(admin, /data-decision="reject"/);
  assert.match(admin, /status===401\|\|response\.status===403/);
});


test('marketplace image upload requires owner authentication, private R2 storage and content verification', async () => {
  const source = await readFile(new URL('../functions/api/market/images/upload.js', import.meta.url), 'utf8');
  assert.match(source, /originAllowed/);
  assert.match(source, /requireMarketUser/);
  assert.match(source, /owner_user_id\s*=\s*\?/);
  assert.match(source, /status IN \('pending','active'\)/);
  assert.match(source, /MAX_IMAGE_BYTES=5\*1024\*1024/);
  assert.match(source, /IMAGE_TYPES/);
  assert.match(source, /IMAGE_CONTENT_MISMATCH/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /env\.R2_BUCKET\.put/);
  assert.match(source, /IMAGE_STORAGE_NOT_CONFIGURED/);
  assert.doesNotMatch(source, /file\.name/);
});


test('marketplace image migration and public endpoints enforce published visibility', async () => {
 const sql=await readFile(new URL('../migrations/0011_marketplace_images.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS marketplace_images/);
 assert.match(sql,/object_key TEXT NOT NULL UNIQUE/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS marketplace_listing_images/);
 const image=await readFile(new URL('../functions/api/market/images/[id].js',import.meta.url),'utf8');
 assert.match(image,/l\.status='published'/);
 assert.match(image,/s\.status='active'/);
 const store=await readFile(new URL('../functions/api/market/stores/public.js',import.meta.url),'utf8');
 assert.match(store,/status='active'/);
 assert.match(store,/status='published'/);
 const detail=await readFile(new URL('../functions/api/market/listings/[id].js',import.meta.url),'utf8');
 assert.match(detail,/status='published'/);
});

test('listing create limits image count and verifies ownership', async () => {
 const source=await readFile(new URL('../functions/api/market/listings.js',import.meta.url),'utf8');
 assert.match(source,/imageIds.length > 6/);
 assert.match(source,/IMAGE_NOT_OWNED_OR_INVALID/);
 assert.match(source,/marketplace_listing_images/);
});

test('marketplace image migration and public endpoints enforce published visibility', async () => {
 const sql=await readFile(new URL('../migrations/0011_marketplace_images.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS marketplace_images/);
 assert.match(sql,/object_key TEXT NOT NULL UNIQUE/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS marketplace_listing_images/);
 const image=await readFile(new URL('../functions/api/market/images/[id].js',import.meta.url),'utf8');
 assert.match(image,/l\.status='published'/);
 assert.match(image,/s\.status='active'/);
 const store=await readFile(new URL('../functions/api/market/stores/public.js',import.meta.url),'utf8');
 assert.match(store,/status='active'/);
 assert.match(store,/status='published'/);
 const detail=await readFile(new URL('../functions/api/market/listings/[id].js',import.meta.url),'utf8');
 assert.match(detail,/status='published'/);
});

test('listing create limits image count and verifies image ownership', async () => {
 const source=await readFile(new URL('../functions/api/market/listings.js',import.meta.url),'utf8');
 assert.match(source,/imageIds.length > 6/);
 assert.match(source,/IMAGE_NOT_OWNED_OR_INVALID/);
 assert.match(source,/marketplace_listing_images/);
 const seller=await readFile(new URL('../src/market-seller.js',import.meta.url),'utf8');
 assert.match(seller,/api\/market\/images\/upload/);
 assert.match(seller,/imageIds/);
});


test('listing and attached images are inserted through one atomic D1 batch', async () => {
  const source = await readFile(new URL('../functions/api/market/listings.js', import.meta.url), 'utf8');
  assert.match(source, /const statements = \[/);
  assert.match(source, /\.\.\.imageIds\.map\(/);
  assert.match(source, /await env\.DB\.batch\(statements\)/);
  assert.doesNotMatch(source, /for \(let index = 0; index < imageIds\.length; index\+\+\) await env\.DB/);
});


test('unused marketplace image deletion is authenticated, owner-scoped and blocked when linked', async () => {
  const source = await readFile(new URL('../functions/api/market/images/[id].js', import.meta.url), 'utf8');
  assert.match(source, /onRequestDelete/);
  assert.match(source, /originAllowed/);
  assert.match(source, /requireMarketUser/);
  assert.match(source, /owner_user_id=\?/);
  assert.match(source, /NOT EXISTS \(SELECT 1 FROM marketplace_listing_images WHERE image_id=\?\)/);
  assert.match(source, /status='deleted'/);
  const seller = await readFile(new URL('../src/market-seller.js', import.meta.url), 'utf8');
  assert.match(seller, /method:'DELETE'/);
});
