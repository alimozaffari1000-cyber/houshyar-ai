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
