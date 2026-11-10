import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as campaignsGet, onRequestPost as campaignsPost } from '../functions/api/ads/campaigns.js';
import { onRequestPost as eventsPost } from '../functions/api/ads/events.js';
import { onRequestGet as referralsGet, onRequestPost as referralsPost } from '../functions/api/ads/referrals.js';
import { onRequestGet as rewardsGet } from '../functions/api/ads/rewards.js';
import { onRequestGet as reviewGet, onRequestPost as reviewPost } from '../functions/api/ads/review.js';
import { onRequestPost as validateEventPost } from '../functions/api/ads/validate-event.js';

const request = (path, method = 'GET', body) => new Request('https://example.test' + path, {
  method,
  headers: { ...(body ? { 'Content-Type': 'application/json', Origin: 'https://example.test' } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {})
});

test('all advertising routes fail closed until the marketplace feature flag is enabled', async () => {
  const env = { ADS_MARKETPLACE_ENABLED: 'false' };
  const cases = [
    campaignsGet({ request: request('/api/ads/campaigns'), env }),
    campaignsPost({ request: request('/api/ads/campaigns', 'POST', {}), env }),
    eventsPost({ request: request('/api/ads/events', 'POST', {}), env }),
    referralsGet({ request: request('/api/ads/referrals'), env }),
    referralsPost({ request: request('/api/ads/referrals', 'POST', {}), env }),
    rewardsGet({ request: request('/api/ads/rewards'), env }),
    reviewGet({ request: request('/api/ads/review'), env }),
    reviewPost({ request: request('/api/ads/review', 'POST', {}), env }),
    validateEventPost({ request: request('/api/ads/validate-event', 'POST', {}), env })
  ];
  for (const response of await Promise.all(cases)) {
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'ADS_NOT_CONFIGURED');
  }
});

test('enabled advertising routes require an authenticated session', async () => {
  const env = { ADS_MARKETPLACE_ENABLED: 'true', AUTH_ENABLED: 'true', DB: {} };
  const responses = await Promise.all([
    campaignsGet({ request: request('/api/ads/campaigns'), env }),
    referralsGet({ request: request('/api/ads/referrals'), env }),
    rewardsGet({ request: request('/api/ads/rewards'), env }),
    reviewGet({ request: request('/api/ads/review'), env })
  ]);
  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'AUTH_REQUIRED');
  }
});
