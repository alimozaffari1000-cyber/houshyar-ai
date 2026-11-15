import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDesignPrompt } from '../src/design-studio.js';

test('builds an original prompt using the selected business details', () => {
  const prompt = buildDesignPrompt({
    businessType: 'فروشگاه پوشاک',
    brand: 'هوش‌پوش',
    audience: 'خریداران آنلاین',
    language: 'فارسی',
    style: '1',
    colors: 'سرمه‌ای و فیروزه‌ای',
    sections: 'محصولات، راهنمای سایز، تماس',
    template: 'boutique',
    locale: 'fa'
  });
  assert.match(prompt, /هوش‌پوش/);
  assert.match(prompt, /فروشگاه پوشاک/);
  assert.match(prompt, /boutique|فروشگاه پوشاک/);
  assert.match(prompt, /Do not imitate an existing brand/);
});

test('uses safe defaults when optional fields are omitted', () => {
  const prompt = buildDesignPrompt({ businessType: 'Consulting', locale: 'en' });
  assert.match(prompt, /Consulting/);
  assert.match(prompt, /accessible, cohesive palette/);
  assert.match(prompt, /Hero, benefits/);
});
