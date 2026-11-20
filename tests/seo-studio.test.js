import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeoAuditPrompt } from '../src/seo-studio.js';

test('SEO audit prompt includes the supplied site and business context', () => {
  const prompt = buildSeoAuditPrompt({
    website: 'https://example.com/',
    business: 'فروشگاه پوشاک',
    market: 'ایران',
    keywords: 'خرید لباس، پوشاک زنانه',
    competitors: 'competitor.example',
    contentLanguage: 'فارسی'
  }, 'fa');
  assert.match(prompt, /https:\/\/example\.com\//);
  assert.match(prompt, /فروشگاه پوشاک/);
  assert.match(prompt, /ایران/);
  assert.match(prompt, /خرید لباس، پوشاک زنانه/);
  assert.match(prompt, /competitor\.example/);
});

test('SEO audit prompt explicitly distinguishes verified data from assumptions', () => {
  const prompt = buildSeoAuditPrompt({
    website: 'https://example.com',
    business: 'Local service',
    market: 'United States',
    keywords: 'plumber near me',
    contentLanguage: 'English'
  }, 'en');
  assert.match(prompt, /requires verification/);
  assert.match(prompt, /never invent site errors, rankings, or metrics/i);
  assert.match(prompt, /30-day content plan/i);
});

test('SEO audit prompt works with an unsupported UI locale using English fallback', () => {
  const prompt = buildSeoAuditPrompt({
    website: 'https://example.org',
    business: 'Business',
    market: 'Global',
    keywords: 'service',
    contentLanguage: 'English'
  }, 'de');
  assert.match(prompt, /Act as a senior SEO/);
  assert.match(prompt, /impact\/effort prioritization/);
});
