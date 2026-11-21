import test from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '../src/i18n.js';

test('changing the interface locale updates document language and direction', () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const documentElement = { lang: 'fa', dir: 'rtl' };
  const saved = new Map();

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: { documentElement }
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: { setItem: (key, value) => saved.set(key, value) }
  });

  try {
    assert.equal(setLocale('en'), 'en');
    assert.deepEqual(
      { lang: documentElement.lang, dir: documentElement.dir },
      { lang: 'en', dir: 'ltr' }
    );
    assert.equal(saved.get('houshyar.locale'), 'en');

    assert.equal(setLocale('ar'), 'ar');
    assert.deepEqual(
      { lang: documentElement.lang, dir: documentElement.dir },
      { lang: 'ar', dir: 'rtl' }
    );
    assert.equal(saved.get('houshyar.locale'), 'ar');

    assert.equal(setLocale('unsupported-locale'), 'fa');
    assert.deepEqual(
      { lang: documentElement.lang, dir: documentElement.dir },
      { lang: 'fa', dir: 'rtl' }
    );
    assert.equal(saved.get('houshyar.locale'), 'fa');
  } finally {
    if (previousDocument) {
      Object.defineProperty(globalThis, 'document', previousDocument);
    } else {
      delete globalThis.document;
    }
    if (previousStorage) {
      Object.defineProperty(globalThis, 'localStorage', previousStorage);
    } else {
      delete globalThis.localStorage;
    }
  }
});
