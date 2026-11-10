import test from 'node:test';
import assert from 'node:assert/strict';
import { listPaymentMethods, getPaymentMethod } from '../src/payments/catalog.js';
import { onRequestGet, onRequestPost } from '../functions/api/payments/methods.js';

test('catalog contains only explicitly network-qualified payment methods', () => {
  const methods = listPaymentMethods();
  assert.ok(methods.some(m => m.id === 'usdt-trc20' && m.network === 'TRON (TRC-20)'));
  assert.ok(methods.some(m => m.id === 'xrp' && m.network === 'XRP Ledger'));
  assert.ok(methods.some(m => m.id === 'trx' && m.network === 'TRON'));
  assert.ok(methods.every(m => m.enabled === false));
});

test('USDT is explicitly marked issuer-freezable', () => {
  assert.equal(getPaymentMethod('usdt-trc20').issuerFreeze, true);
  assert.equal(getPaymentMethod('usdt-trc20').custody, 'token_issuer_controlled');
});

test('native coins are not labelled as issuer-freezable tokens', () => {
  for (const id of ['ltc', 'xrp', 'trx', 'xmr', 'btc-lightning']) {
    assert.equal(getPaymentMethod(id).issuerFreeze, false);
  }
});

test('unknown method cannot be resolved', () => {
  assert.equal(getPaymentMethod('usdt-any-network'), null);
});

test('public endpoint lists catalogue but does not enable payments', async () => {
  const response = await onRequestGet();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.mode, 'catalog_only');
  assert.equal(body.livePaymentsEnabled, false);
  assert.equal(body.methods.every(m => !m.enabled), true);
});

test('invoice creation fails closed until payment processing is implemented', async () => {
  const response = await onRequestPost();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'PAYMENTS_NOT_CONFIGURED');
});
