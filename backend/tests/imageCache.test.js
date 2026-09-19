import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageCache } from '../lib/imageCache.js';

const image = (size = 4) => ({ data: Buffer.alloc(size), contentType: 'image/jpeg' });

test('concurrent and repeat poster requests share one upstream download', async () => {
  const cache = createImageCache();
  let calls = 0;
  const load = async () => { calls++; return image(); };
  const [a, b] = await Promise.all([cache.get('poster', load), cache.get('poster', load)]);
  assert.equal(a, b);
  assert.equal(await cache.get('poster', load), a);
  assert.equal(calls, 1);
});

test('failed downloads are retryable and expired images refresh', async () => {
  let time = 0;
  const cache = createImageCache({ ttlMs: 10, now: () => time });
  await assert.rejects(cache.get('a', async () => { throw new Error('reset'); }));
  const first = await cache.get('a', async () => image());
  time = 11;
  const next = await cache.get('a', async () => image());
  assert.notEqual(first, next);
});

test('byte budget evicts least recently used image', async () => {
  const cache = createImageCache({ maxBytes: 8 });
  const a = await cache.get('a', async () => image());
  const b = await cache.get('b', async () => image());
  assert.equal(await cache.get('a', async () => image()), a);
  await cache.get('c', async () => image());
  assert.notEqual(await cache.get('b', async () => image()), b);
});

test('entry limit and oversized images cannot grow cache without bound', async () => {
  const cache = createImageCache({ maxBytes: 8, maxEntries: 1 });
  const a = await cache.get('a', async () => image());
  await cache.get('b', async () => image());
  assert.notEqual(await cache.get('a', async () => image()), a);
  let calls = 0;
  const large = async () => { calls++; return image(9); };
  await cache.get('large', large);
  await cache.get('large', large);
  assert.equal(calls, 2);
});
