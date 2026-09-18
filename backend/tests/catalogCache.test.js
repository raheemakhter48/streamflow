import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogCache } from '../lib/catalogCache.js';

test('concurrent cold requests share one load and reuse fresh results', async () => {
  const cache = createCatalogCache();
  let calls = 0;
  const loader = async () => { calls++; return { title: 'Test' }; };
  const results = await Promise.all([cache.get('a', loader), cache.get('a', loader)]);
  assert.equal(calls, 1);
  assert.deepEqual(results[0], results[1]);
  await cache.get('a', loader);
  assert.equal(calls, 1);
});

test('temporary failures can use recent stale data but do not extend its lifetime', async () => {
  let clock = 0;
  const cache = createCatalogCache({ ttlMs: 10, staleMs: 20, now: () => clock });
  await cache.get('a', async () => 'saved');
  const offline = async () => { throw new Error('offline'); };
  clock = 11;
  assert.equal(await cache.get('a', offline, () => true), 'saved');
  clock = 31;
  await assert.rejects(cache.get('a', offline, () => true), /offline/);
});

test('permanent errors are not hidden by stale data, and failures can be retried', async () => {
  let clock = 0;
  const cache = createCatalogCache({ ttlMs: 10, now: () => clock });
  await cache.get('a', async () => 'saved');
  clock = 11;
  await assert.rejects(cache.get('a', async () => { throw new Error('unauthorized'); }), /unauthorized/);
  assert.equal(await cache.get('a', async () => 'recovered'), 'recovered');
});

test('cache eviction bounds memory', async () => {
  const cache = createCatalogCache({ maxEntries: 2 });
  for (const key of ['a', 'b', 'c']) await cache.get(key, async () => key);
  assert.equal(await cache.get('a', async () => 'reloaded'), 'reloaded');
  assert.equal(await cache.get('c', async () => 'unexpected'), 'c');
});
